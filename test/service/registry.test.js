const {
    addressToScript,
    rawTransactionToHash,
    scriptToHash,
    serializeWitnessArgs,
    serializeScript,
} = require('@nervosnetwork/ckb-sdk-utils')
const { Collector, Aggregator, getAlwaysSuccessLock, generateRegisterCotaTx, FEE } = require("@nervina-labs/cota-sdk")
const { registryURL, cotaURL, ckbNodeUrl, ckbIndexerUrl } = require('../../utils');
const { define, mint, transfer, waitTxStatus, generatePrivAddr, readLog, secp256k1CellDep } = require('../../utils/common')
const chai = require('chai')
const expect = require('chai').expect
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);


describe('Registry test', () => {

    const service = {
        collector: new Collector({ ckbNodeUrl, ckbIndexerUrl }),
        aggregator: new Aggregator({ registryUrl: registryURL, cotaUrl: cotaURL }),
    }
    const ckb = service.collector.getCkb()
    // True for mainnet and false for testnet
    const isMainnet = false

    const PROVIDE_TEST_PRIVATE_KEY = '0x3a656e0bf4abb8e2a43f43f7aaccecc8efe00cfad113489a12a3f99bd2dd9407'
    const PROVIDE_TEST_ADDRESS = 'ckt1qyqrlvtxs05akvmlu5xm5x2rz2ek8kuypppshrd84e' // Alicemocha
    const RECEIVER_ADDRESS = 'ckt1qyqy5pcdq2tx84j6ca3zg3sd56z0t0xsadlsjwm4fj' //Bobs
    const RECEIVER_PRIVATE_KEY = '0x0931b7775cc0806e55c8c54ef74b077dec9003ed848953df1bb7d4824c66936b'
    const OTHER_ADDRESS = 'ckt1qyqzjk6saht5u3r7894kjvhkepl4vpgdqe0savd4zd' //Tom

    const registry = async (TEST_ADDRESS) => {
        const provideCKBLock = addressToScript(PROVIDE_TEST_ADDRESS)
        const unregisteredCotaLock = addressToScript(TEST_ADDRESS)
        console.log(`provideCKBLock: ${JSON.stringify(provideCKBLock)}
    unregisteredCotaLock: ${JSON.stringify(unregisteredCotaLock)}`)
        let rawTx = await generateRegisterCotaTx(service, [unregisteredCotaLock], provideCKBLock, FEE, isMainnet)
        const secp256k1Dep = await secp256k1CellDep(ckb)
        rawTx.cellDeps.push(secp256k1Dep)

        const registryLock = getAlwaysSuccessLock(false)
        let keyMap = new Map()
        keyMap.set(scriptToHash(registryLock), '')
        keyMap.set(scriptToHash(provideCKBLock), PROVIDE_TEST_PRIVATE_KEY)

        const cells = rawTx.inputs.map((input, index) => ({
            outPoint: input.previousOutput,
            lock: index === 0 ? registryLock : provideCKBLock,
        }))

        const transactionHash = rawTransactionToHash(rawTx)
        console.log(`transactionHash: ${transactionHash}`)

        const signedWitnesses = ckb.signWitnesses(keyMap)({
            transactionHash,
            witnesses: rawTx.witnesses,
            inputCells: cells,
            skipMissingKeys: true,
        })

        const signedTx = {
            ...rawTx,
            witnesses: signedWitnesses.map(witness => (typeof witness === 'string' ? witness : serializeWitnessArgs(witness))),
        }
        console.log('signedTx: ', JSON.stringify(signedTx))
        return signedTx
    }

    const fakeRun = async (TEST_ADDRESS) => {
        console.log("=====fake run without sending registry=====")
        await registry(TEST_ADDRESS)
    }

    const realRun = async (TEST_ADDRESS) => {
        console.log("=====real run sending registry=====")
        let signedTx = await registry(TEST_ADDRESS) // second time run
        let txHash = await ckb.rpc.sendTransaction(signedTx, 'passthrough')
        console.log(`Register cota cell tx has been sent with tx hash ${txHash}`)
        return txHash
    }

    const fakeRealRun = async (TEST_ADDRESS) => {
        await fakeRun(TEST_ADDRESS)
        return await realRun(TEST_ADDRESS)
    }


    it('case1: expect sending registry successfully after fake sending', async () => {
        let Tom = generatePrivAddr()
        const TEST_ADDRESS = Tom.addrTestnet
        const TEST_PRIVATE_KEY = Tom.privkey

        let txHash = await fakeRealRun(TEST_ADDRESS)
        console.log("sending registry txHash: ", txHash)
        expect(txHash).not.null
        await expect(realRun(TEST_ADDRESS)).to.eventually.rejectedWith('PoolRejectedDuplicatedTransaction')
        await waitTxStatus(ckb, txHash)
        console.log("=========1 case1 registry tx end=========")

        // define with the new registered account
        const defineCotaInfo = {
            name: `NFT for registry Test-v2-2022-${new Date().getTime()}`,
            description: "v2-2022-The NFT for cota registry Test with new registered account.\n\n-- From SMT can make the cost reduction.",
            image: "https://www.nasa.gov/sites/default/files/thumbnails/image/main_image_deep_field_smacs0723-5mb.jpg", // "https://oss.jinse.cc/production/59b3285a-c676-47d3-ba63-264b977f3ce1.jpg",
        }
        let defineToken = await define(ckb, service, defineCotaInfo, TEST_ADDRESS, TEST_PRIVATE_KEY, isMainnet) // second time run
        let defineTxHash = await ckb.rpc.sendTransaction(defineToken.signedTx, 'passthrough')
        console.info(`Define cota nft tx has been sent with tx hash ${defineTxHash}`)
        expect(defineTxHash).not.null
        await waitTxStatus(ckb, defineTxHash)

        // mint with the new defined cota using existing definer
        let cotaId = defineToken.cotaId
        const mintCotaInfo = {
            cotaId: cotaId,
            withdrawals: [
                {
                    state: '0x00',
                    characteristic: '0x050505050505050505050505050505050505AAA0',
                    toLockScript: serializeScript(addressToScript(RECEIVER_ADDRESS)),
                },
                {
                    state: '0x00',
                    characteristic: '0x050505050505050505050505050505050505AAA1',
                    toLockScript: serializeScript(addressToScript(RECEIVER_ADDRESS)),
                },
            ],
        }
        let mintSignedTx = await mint(ckb, service, mintCotaInfo, TEST_ADDRESS, RECEIVER_ADDRESS, TEST_PRIVATE_KEY, isMainnet) // second time run
        let mintTxHash = await ckb.rpc.sendTransaction(mintSignedTx, 'passthrough')
        console.info(`Mint cota nft tx has been sent with tx hash ${mintTxHash}`)
        expect(mintTxHash).not.null
        await waitTxStatus(ckb, mintTxHash)

        // transfer
        let transferSignedTx = await transfer(ckb, service, cotaId, "0x00000000", TEST_ADDRESS, RECEIVER_ADDRESS, OTHER_ADDRESS, RECEIVER_PRIVATE_KEY, isMainnet) // second time run
        let tranferTxHash = await ckb.rpc.sendTransaction(transferSignedTx, 'passthrough')
        console.info(`Transfer cota nft tx has been sent with tx hash ${tranferTxHash}`)
        expect(tranferTxHash).not.null
        await waitTxStatus(ckb, tranferTxHash)
    })

    it('case2: expect cannot send registry for registered address', async () => {
        const TEST_PRIVATE_KEY = '0x515775d434918708a6cc2eb7fc0517f8e7372d1f535e9b05822dd1a309be307c'
        const TEST_ADDRESS = 'ckt1qyqg5y42arwveww54zd0gv39wjcyswlzrlxqhp9nf8'

        await expect(realRun(TEST_ADDRESS)).to.eventually.rejectedWith("Cannot destructure property 'smtRootHash' of '(intermediate value)' as it is undefined.")
        readLog("registry.log", "The lock_hash has registered");
    })

})