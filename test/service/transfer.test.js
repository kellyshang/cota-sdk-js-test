const { Collector, Aggregator } = require('@nervina-labs/cota-sdk')
const { registryURL, cotaURL, ckbNodeUrl, ckbIndexerUrl } = require('../../utils')
const { transfer, waitTxStatus, getFirstWithdrawCotaNFT, readLog } = require('../../utils/common')
const chai = require('chai')
const expect = require('chai').expect
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);


describe('Transfer test', () => {

    const service = {
        collector: new Collector({ ckbNodeUrl, ckbIndexerUrl }),
        aggregator: new Aggregator({ registryUrl: registryURL, cotaUrl: cotaURL }),
    }
    const ckb = service.collector.getCkb()
    // True for mainnet and false for testnet
    const isMainnet = false

    const TEST_ADDRESS = 'ckt1qyq9ss6yfa6geaf8h094ajuwhukpskzt9uls9mgsam' //AliceStress
    const RECEIVER_ADDRESS = 'ckt1qyqy5pcdq2tx84j6ca3zg3sd56z0t0xsadlsjwm4fj' //Bobs
    const RECEIVER_PRIVATE_KEY = '0x0931b7775cc0806e55c8c54ef74b077dec9003ed848953df1bb7d4824c66936b'
    const OTHER_ADDRESS = 'ckt1qyqzjk6saht5u3r7894kjvhkepl4vpgdqe0savd4zd' //Tom

    let cotaID = '0x160db3c084d6af19dc2a05f70edcd17a81d7e999'
    let getCotaNFT
    let tokenIndex

    const fakeRun = async (cotaID, tokenIndex) => {
        console.log("=====fake run without sending transfer=====")
        console.log(`in fakeRun the getCotaNFT and tokenIndex: ${JSON.stringify(getCotaNFT)}, ${tokenIndex}`)
        await transfer(ckb, service, cotaID, tokenIndex, TEST_ADDRESS, RECEIVER_ADDRESS, OTHER_ADDRESS, RECEIVER_PRIVATE_KEY, isMainnet) // first time run
    }

    const realRun = async (cotaID, tokenIndex) => {
        console.log("=====real run sending transfer=====")
        console.log(`in realRun the getCotaNFT and tokenIndex: ${JSON.stringify(getCotaNFT)}, ${tokenIndex}`)
        let signedTx = await transfer(ckb, service, cotaID, tokenIndex, TEST_ADDRESS, RECEIVER_ADDRESS, OTHER_ADDRESS, RECEIVER_PRIVATE_KEY, isMainnet) // second time run

        let txHash = await ckb.rpc.sendTransaction(signedTx, 'passthrough')
        console.info(`Transfer cota nft tx has been sent with tx hash ${txHash}`)
        return txHash
    }

    const fakeRealRun = async (cotaID, tokenIndex) => {
        console.log(`in fakeRealRun the getCotaNFT and tokenIndex: ${JSON.stringify(getCotaNFT)}, ${tokenIndex}`)
        await fakeRun(cotaID, tokenIndex)
        return await realRun(cotaID, tokenIndex)
    }

    before(async () => {
        getCotaNFT = await getFirstWithdrawCotaNFT(service, cotaID, RECEIVER_ADDRESS)
        tokenIndex = getCotaNFT.tokenIndex
        console.log("tokenindex in before: ", tokenIndex)
    })


    it('case1: expect sending transfer successfully after fake sending', async () => {
        console.log(`tokenindex in case1: ${cotaID}, ${tokenIndex}`)
        let txHash = await fakeRealRun(cotaID, tokenIndex)
        console.log("sending transfer txHash: ", txHash)
        expect(txHash).not.null
        await expect(realRun(cotaID, tokenIndex)).to.eventually.rejectedWith('PoolRejectedDuplicatedTransaction')
        await waitTxStatus(ckb, txHash)
    })

    it('case2: expect error when transfer with owned non-withdrawl cota nft', async () => {
        tokenIndex = '0x000003c1'
        console.log(`tokenindex in case2: ${cotaID}, ${tokenIndex}`)
        await expect(realRun(cotaID, tokenIndex)).to.eventually.rejectedWith("Cannot destructure property 'smtRootHash' of '(intermediate value)' as it is undefined.")
        readLog("transfer.log", "The cota_id and token_index has not withdrawn");
    })

    // TODO: should report with `has not withdrawn` error after fixed
    it('case3: expect error when transfer with non-owned non-withdrawl cota nft', async () => {
        console.log(`tokenindex in case3: ${cotaID}, ${tokenIndex}`)
        await expect(realRun(cotaID, "0x000003bd")).to.eventually.rejectedWith(
            '{"code":-302,"message":"TransactionFailedToVerify: Verification failed Script(TransactionScriptError { source: Inputs[0].Type, cause: ValidationFailure: see the error code 34 in the page https://nervosnetwork.github.io/ckb-script-error-codes/by-type-hash/89cd8003a0eaf8e65e0c31525b7d1d5c1becefd2ea75bb4cff87810ae37764d8.html#34 })","data":"Verification(Error { kind: Script, inner: TransactionScriptError { source: Inputs[0].Type, cause: ValidationFailure: see the error code 34 in the page https://nervosnetwork.github.io/ckb-script-error-codes/by-type-hash/89cd8003a0eaf8e65e0c31525b7d1d5c1becefd2ea75bb4cff87810ae37764d8.html#34 } })"}')
    })

    it('case4: expect error when transferUpdate with non-existing cotaID nft', async () => {
        await expect(realRun("0x160db3c084d6af19dc2a05f70edcd17a81d7eAAA", "0x00000000")).to.eventually.rejectedWith(
            "Cannot destructure property 'smtRootHash' of '(intermediate value)' as it is undefined.")
        readLog("transfer.log", "The cota_id and token_index has not withdrawn");
    })

})


