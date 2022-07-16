const { addressToScript, serializeScript } = require('@nervosnetwork/ckb-sdk-utils')
const { Collector, Aggregator } = require("@nervina-labs/cota-sdk")
const { generateWithdrawCotaTx } = require('@nervina-labs/cota-sdk/lib/service/cota')
const { registryURL, cotaURL, ckbNodeUrl, ckbIndexerUrl } = require('../../utils');
const { waitTxStatus, secp256k1CellDep, getFirstHoldCotaNFT, readLog } = require('../../utils/common')
const chai = require('chai')
const expect = require('chai').expect
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);


describe('Withdraw test', () => {

    const service = {
        collector: new Collector({ ckbNodeUrl, ckbIndexerUrl }),
        aggregator: new Aggregator({ registryUrl: registryURL, cotaUrl: cotaURL }),
    }
    const ckb = service.collector.getCkb()
    // True for mainnet and false for testnet
    const isMainnet = false

    const TEST_ADDRESS = 'ckt1qyqy5pcdq2tx84j6ca3zg3sd56z0t0xsadlsjwm4fj' //Bobs
    const TEST_PRIVATE_KEY = '0x0931b7775cc0806e55c8c54ef74b077dec9003ed848953df1bb7d4824c66936b'
    const RECEIVER_ADDRESS = 'ckt1qyqzjk6saht5u3r7894kjvhkepl4vpgdqe0savd4zd' //Tom

    let cotaID = '0x160db3c084d6af19dc2a05f70edcd17a81d7e999'
    let getCotaNFT
    let tokenIndex

    before(async () => {
        getCotaNFT = await getFirstHoldCotaNFT(service, cotaID, TEST_ADDRESS)
        tokenIndex = getCotaNFT.tokenIndex
        console.log("tokenindex in before: ", tokenIndex)
    })

    const withdraw = async (cotaID, tokenIndex) => {
        const withdrawLock = addressToScript(TEST_ADDRESS)
        const toLock = addressToScript(RECEIVER_ADDRESS)

        const withdrawals = [
            {
                cotaId: cotaID,
                tokenIndex: tokenIndex,
                toLockScript: serializeScript(toLock),
            },
        ]
        console.log(`serializeScript TEST_ADDRESS: ${serializeScript(addressToScript(TEST_ADDRESS))}`)
        console.log(`serializeScript RECEIVER_ADDRESS: ${serializeScript(addressToScript(RECEIVER_ADDRESS))}`)
        let rawTx = await generateWithdrawCotaTx(service, withdrawLock, withdrawals)

        const secp256k1Dep = await secp256k1CellDep(ckb)
        rawTx.cellDeps.push(secp256k1Dep)

        const signedTx = ckb.signTransaction(TEST_PRIVATE_KEY)(rawTx)
        console.log(`signedTx: ${JSON.stringify(signedTx)}`)
        return signedTx
    }

    const fakeRun = async (cotaID, tokenIndex) => {
        console.log("=====fake run without sending withdraw=====")
        await withdraw(cotaID, tokenIndex)
    }

    const realRun = async (cotaID, tokenIndex) => {
        console.log("=====real run sending withdraw=====")
        let signedTx = await withdraw(cotaID, tokenIndex)
        let txHash = await ckb.rpc.sendTransaction(signedTx, 'passthrough')
        console.info(`Withdraw cota nft tx has been sent with tx hash ${txHash}`)
        return txHash
    }

    const fakeRealRun = async (cotaID, tokenIndex) => {
        await fakeRun(cotaID, tokenIndex)
        return await realRun(cotaID, tokenIndex)
    }

    it('case1: expect sending withdraw successfully after fake sending', async () => {
        console.log(`tokenindex in case1: ${cotaID}, ${tokenIndex}`)
        let txHash = await fakeRealRun(cotaID, tokenIndex)
        console.log("sending withdraw txHash: ", txHash)
        expect(txHash).not.null
        await expect(realRun(cotaID, tokenIndex)).to.eventually.rejectedWith('PoolRejectedDuplicatedTransaction')
        await waitTxStatus(ckb, txHash)
    })

    it('case2: expect error when withdraw with owned non-withdrawl cota nft', async () => {
        tokenIndex = '0x000003c1'
        console.log(`tokenindex in case2: ${cotaID}, ${tokenIndex}`)
        await expect(realRun(cotaID, tokenIndex)).to.eventually.rejectedWith("Cannot destructure property 'smtRootHash' of '(intermediate value)' as it is undefined.")
        readLog("withdraw.log", "The cota_id and token_index has not held");
    })

    // TODO: should report with `has not held` error after fixed
    it('case3: expect error when withdraw with non-owned non-withdrawl cota nft', async () => {
        console.log(`tokenindex in case3: ${cotaID}, ${tokenIndex}`)
        await expect(realRun(cotaID, "0x000003bd")).to.eventually.rejectedWith(
            "Cannot destructure property 'smtRootHash' of '(intermediate value)' as it is undefined.")
        readLog("withdraw.log", "The cota_id and token_index has not held");
    })

    it('case4: expect error when withdraw with non-existing cotaID nft', async () => {
        await expect(realRun("0x160db3c084d6af19dc2a05f70edcd17a81d7eAAA", "0x00000000")).to.eventually.rejectedWith(
            "Cannot destructure property 'smtRootHash' of '(intermediate value)' as it is undefined.")
        readLog("withdraw.log", "The cota_id and token_index has not held");
    })

})