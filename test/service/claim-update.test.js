const { addressToScript, serializeScript } = require('@nervosnetwork/ckb-sdk-utils')
const { Collector, Aggregator, generateClaimUpdateCotaTx, FEE } = require('@nervina-labs/cota-sdk')
const { registryURL, cotaURL, ckbNodeUrl, ckbIndexerUrl } = require('../../utils');
const { waitTxStatus, secp256k1CellDep, getFirstWithdrawCotaNFT, readLog } = require('../../utils/common')
const chai = require('chai')
const expect = require('chai').expect
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);


describe('Claim-Update test', () => {

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

  let cotaID = '0x160db3c084d6af19dc2a05f70edcd17a81d7e999'
  let getCotaNFT
  let tokenIndex

  before(async () => {
    getCotaNFT = await getFirstWithdrawCotaNFT(service, cotaID, RECEIVER_ADDRESS)
    tokenIndex = getCotaNFT.tokenIndex
    console.log("tokenindex in before: ", tokenIndex)
  })

  const claimUpdate = async (cotaID, tokenIndex) => {
    const claimLock = addressToScript(RECEIVER_ADDRESS)
    const withdrawLock = addressToScript(TEST_ADDRESS)

    const nfts = [
      {
        cotaId: cotaID,
        tokenIndex: tokenIndex,
        state: '0x00',
        characteristic: '0x050505050505050505050505050505050505CCCC',
      },
    ]
    console.log(`serializeScript TEST_ADDRESS: ${serializeScript(addressToScript(TEST_ADDRESS))}`)
    console.log(`serializeScript RECEIVER_ADDRESS: ${serializeScript(addressToScript(RECEIVER_ADDRESS))}`)
    let rawTx = await generateClaimUpdateCotaTx(service, claimLock, withdrawLock, nfts, FEE, isMainnet)

    const secp256k1Dep = await secp256k1CellDep(ckb)
    rawTx.cellDeps.push(secp256k1Dep)

    const signedTx = ckb.signTransaction(RECEIVER_PRIVATE_KEY)(rawTx)
    console.log(`claim-update signed tx: ${JSON.stringify(signedTx)}`)
    return signedTx
  }

  const fakeRun = async (cotaID, tokenIndex) => {
    console.log("=====fake run without sending claimUpdate=====")
    await claimUpdate(cotaID, tokenIndex)
  }

  const realRun = async (cotaID, tokenIndex) => {
    console.log("=====real run sending claimUpdate=====")
    let signedTx = await claimUpdate(cotaID, tokenIndex)
    let txHash = await ckb.rpc.sendTransaction(signedTx, 'passthrough')
    console.info(`Claim and update cota nft tx has been sent with tx hash ${txHash}`)
    return txHash
  }

  const fakeRealRun = async (cotaID, tokenIndex) => {
    await fakeRun(cotaID, tokenIndex)
    return await realRun(cotaID, tokenIndex)
  }

  it('case1: expect sending claimUpdate successfully after fake sending', async () => {
    console.log(`tokenindex in case1: ${cotaID}, ${tokenIndex}`)
    let txHash = await fakeRealRun(cotaID, tokenIndex)
    console.log("sending claimUpdate txHash: ", txHash)
    expect(txHash).not.null
    await expect(realRun(cotaID, tokenIndex)).to.eventually.rejectedWith('PoolRejectedDuplicatedTransaction')
    await waitTxStatus(ckb, txHash)
  })

  it('case2: expect error when claimUpdate with owned non-withdrawl cota nft', async () => {
    console.log("started")
    tokenIndex = '0x000003c1'
    console.log(`tokenindex in case2: ${cotaID}, ${tokenIndex}`)
    await expect(realRun(cotaID, tokenIndex)).to.eventually.rejectedWith("Cannot destructure property 'smtRootHash' of '(intermediate value)' as it is undefined.")
    readLog("claimUpdate.log", "The cota_id and token_index has not withdrawn");
  })

  // TODO: should report with `has not withdrawn` error after fixed
  it('case3: expect error when claimUpdate with non-owned non-withdrawl cota nft', async () => {
    console.log(`tokenindex in case3: ${cotaID}, ${tokenIndex}`)
    await expect(realRun(cotaID, "0x000003bd")).to.eventually.rejectedWith(
      `Cannot destructure property 'smtRootHash' of '(intermediate value)' as it is undefined.`)
  })

  it('case4: expect error when claimUpdate with non-existing cotaID nft', async () => {
    await expect(realRun("0x160db3c084d6af19dc2a05f70edcd17a81d7eAAA", "0x00000000")).to.eventually.rejectedWith(
      "Cannot destructure property 'smtRootHash' of '(intermediate value)' as it is undefined.")
    readLog("claimUpdate.log", "The cota_id and token_index has not withdrawn");
  })

})