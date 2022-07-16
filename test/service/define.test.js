const { addressToScript, serializeScript } = require('@nervosnetwork/ckb-sdk-utils')
const { Collector, Aggregator } = require('@nervina-labs/cota-sdk')
const { registryURL, cotaURL, ckbNodeUrl, ckbIndexerUrl } = require('../../utils');
const { waitTxStatus, define, mint, transfer } = require('../../utils/common')
const chai = require('chai')
const expect = require('chai').expect
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);

describe('Define test', () => {

    // True for mainnet and false for testnet
    const isMainnet = false

    const service = {
        collector: new Collector({ ckbNodeUrl, ckbIndexerUrl }),
        aggregator: new Aggregator({ registryUrl: registryURL, cotaUrl: cotaURL }),
        // collector: new Collector({ ckbNodeUrl: 'http://localhost:8114', ckbIndexerUrl: 'http://localhost:8116' }),
        // aggregator: new Aggregator({ registryUrl: 'http://localhost:3050', cotaUrl: 'http://localhost:3030' }),
    }
    const ckb = service.collector.getCkb()

    const TEST_PRIVATE_KEY = '0x4f1e70a5f4930c12793c82c7c1bf344f933290c110741ae88a7efc99153a3a1b'
    const TEST_ADDRESS = 'ckt1qyqw3lpsn6ld8f2d3x6llyj7ddvvv6837cvstc6mpm'  // Alicemocha
    const RECEIVER_ADDRESS = 'ckt1qyqy5pcdq2tx84j6ca3zg3sd56z0t0xsadlsjwm4fj' //Bobs
    const RECEIVER_PRIVATE_KEY = '0x0931b7775cc0806e55c8c54ef74b077dec9003ed848953df1bb7d4824c66936b'
    const OTHER_ADDRESS = 'ckt1qyqzjk6saht5u3r7894kjvhkepl4vpgdqe0savd4zd' //Tom

    const cotaInfo = {
        name: `NFT for define Test-v2-2022-${new Date().getTime()}`,
        description: "v2-2022-The NFT for cota define Test with existing account.\n\n-- From SMT can make the cost reduction.",
        image: "https://www.nasa.gov/sites/default/files/thumbnails/image/main_image_deep_field_smacs0723-5mb.jpg", // "https://oss.jinse.cc/production/59b3285a-c676-47d3-ba63-264b977f3ce1.jpg",
    }

    const fakeRun = async (cotaInfo) => {
        console.log("=====fake run without sending define=====")
        await define(ckb, service, cotaInfo, TEST_ADDRESS, TEST_PRIVATE_KEY, isMainnet)
    }

    const realRun = async (cotaInfo) => {
        console.log("=====real run sending define=====")
        let defineTx = await define(ckb, service, cotaInfo, TEST_ADDRESS, TEST_PRIVATE_KEY, isMainnet)
        let txHash = await ckb.rpc.sendTransaction(defineTx.signedTx, 'passthrough')
        console.info(`Define cota nft tx has been sent with tx hash ${txHash}`)
        let cotaId = defineTx.cotaId
        return { txHash, cotaId }
    }

    const fakeRealRun = async (cotaInfo) => {
        await fakeRun(cotaInfo)
        return await realRun(cotaInfo)
    }


    it('case1: expect sending define successfully after fake sending', async () => {
        let defineToken = await fakeRealRun(cotaInfo)
        console.log("sending define txHash: ", defineToken.txHash)
        expect(defineToken.txHash).not.null
        await expect(realRun(cotaInfo)).to.eventually.rejectedWith('PoolRejectedDuplicatedTransaction')
        await waitTxStatus(ckb, defineToken.txHash)
        
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

})
