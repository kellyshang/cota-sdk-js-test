const { addressToScript, serializeScript } = require('@nervosnetwork/ckb-sdk-utils')
const { Collector, Aggregator } = require('@nervina-labs/cota-sdk')
const { registryURL, cotaURL, ckbNodeUrl, ckbIndexerUrl } = require('../../utils')
const { mint, waitTxStatus, getTokenIssued } = require('../../utils/common')
const chai = require('chai')
const expect = require('chai').expect
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);


describe('Mint test', () => {

    const TEST_PRIVATE_KEY = '0xb6b97e885d4005938613e1a28060e55ccfc3386d07808658dbdad8bea3cdcd99'
    const TEST_ADDRESS = 'ckt1qyq9ss6yfa6geaf8h094ajuwhukpskzt9uls9mgsam'   // AliceStress
    const RECEIVER_ADDRESS = 'ckt1qyqy5pcdq2tx84j6ca3zg3sd56z0t0xsadlsjwm4fj' //Bobs

    const service = {
        collector: new Collector({ ckbNodeUrl, ckbIndexerUrl }),
        aggregator: new Aggregator({ registryUrl: registryURL, cotaUrl: cotaURL }),
    }
    const ckb = service.collector.getCkb()
    // True for mainnet and false for testnet
    const isMainnet = false

    const mintCotaInfo = {
        cotaId: '0x160db3c084d6af19dc2a05f70edcd17a81d7e999',
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
            {
                state: '0x00',
                characteristic: '0x050505050505050505050505050505050505AAA2',
                toLockScript: serializeScript(addressToScript(RECEIVER_ADDRESS)),
            },
            {
                state: '0x00',
                characteristic: '0x050505050505050505050505050505050505AAA3',
                toLockScript: serializeScript(addressToScript(RECEIVER_ADDRESS)),
            },
        ],
    }

    const fakeRun = async (mintCotaInfo) => {
        console.log("=====fake run without sending mint=====")
        await mint(ckb, service, mintCotaInfo, TEST_ADDRESS, RECEIVER_ADDRESS, TEST_PRIVATE_KEY, isMainnet)  // first time run
    }

    const realRun = async (mintCotaInfo) => {
        console.log("=====real run sending mint=====")
        let signedTx = await mint(ckb, service, mintCotaInfo, TEST_ADDRESS, RECEIVER_ADDRESS, TEST_PRIVATE_KEY, isMainnet) // second time run
        let txHash = await ckb.rpc.sendTransaction(signedTx, 'passthrough')
        console.info(`Mint cota nft tx has been sent with tx hash ${txHash}`)
        return txHash
    }

    const fakeRealRun = async (mintCotaInfo) => {
        await fakeRun(mintCotaInfo)
        return await realRun(mintCotaInfo)
    }


    it('case1: expect sending mint successfully after fake sending', async () => {
        let txHash = await fakeRealRun(mintCotaInfo)
        console.log("sending mint txHash: ", txHash)
        expect(txHash).not.null
        await expect(realRun(mintCotaInfo)).to.eventually.rejectedWith('PoolRejectedDuplicatedTransaction')
        await waitTxStatus(ckb, txHash)
    })

    it('case2: expect cannot mint token which has been mintted', async () => {
        const mintted_mintCotaInfo = {
            cotaId: '0x160db3c084d6af19dc2a05f70edcd17a81d7e999',
            withdrawals: [
                {
                    tokenIndex: '0x0000000a',
                    state: '0x00',
                    characteristic: '0x050505050505050505050505050505050505AAA0',
                    toLockScript: serializeScript(addressToScript(RECEIVER_ADDRESS)),
                },
            ],
        }

        // error code 27 - CoTA id or token index invalid
        await expect(realRun(mintted_mintCotaInfo)).to.eventually.rejectedWith(
            '{"code":-302,"message":"TransactionFailedToVerify: Verification failed Script(TransactionScriptError { source: Inputs[0].Type, cause: ValidationFailure: see the error code 27 in the page https://nervosnetwork.github.io/ckb-script-error-codes/by-type-hash/89cd8003a0eaf8e65e0c31525b7d1d5c1becefd2ea75bb4cff87810ae37764d8.html#27 })","data":"Verification(Error { kind: Script, inner: TransactionScriptError { source: Inputs[0].Type, cause: ValidationFailure: see the error code 27 in the page https://nervosnetwork.github.io/ckb-script-error-codes/by-type-hash/89cd8003a0eaf8e65e0c31525b7d1d5c1becefd2ea75bb4cff87810ae37764d8.html#27 } })"}'
        )
    })

    it('case3: expect cannot mint token with index discontinuous', async () => {
        let cotaID = '0x160db3c084d6af19dc2a05f70edcd17a81d7e999'
        let tokenIssued = await getTokenIssued(service, cotaID)
        let invalidTokenIssuedHex = (Number(tokenIssued) + 100).toString(16)
        let invalidTokenIndex = `0x${invalidTokenIssuedHex.padStart(8, '0')}`
        console.log(`discontinuous tokenIndex is: ${invalidTokenIndex}`)
        const discontinuous_mintCotaInfo = {
            cotaId: cotaID,
            withdrawals: [
                {
                    tokenIndex: invalidTokenIndex,
                    state: '0x00',
                    characteristic: '0x050505050505050505050505050505050505AAA0',
                    toLockScript: serializeScript(addressToScript(RECEIVER_ADDRESS)),
                },
            ],
        }
        // error code 27 - CoTA id or token index invalid
        await expect(realRun(discontinuous_mintCotaInfo)).to.eventually.rejectedWith(
            '{"code":-302,"message":"TransactionFailedToVerify: Verification failed Script(TransactionScriptError { source: Inputs[0].Type, cause: ValidationFailure: see the error code 27 in the page https://nervosnetwork.github.io/ckb-script-error-codes/by-type-hash/89cd8003a0eaf8e65e0c31525b7d1d5c1becefd2ea75bb4cff87810ae37764d8.html#27 })","data":"Verification(Error { kind: Script, inner: TransactionScriptError { source: Inputs[0].Type, cause: ValidationFailure: see the error code 27 in the page https://nervosnetwork.github.io/ckb-script-error-codes/by-type-hash/89cd8003a0eaf8e65e0c31525b7d1d5c1becefd2ea75bb4cff87810ae37764d8.html#27 } })"}'
        )
    })

})
