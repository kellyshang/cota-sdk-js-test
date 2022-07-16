const { addressToScript, serializeScript } = require('@nervosnetwork/ckb-sdk-utils')
const { Collector, Aggregator, generateTransferUpdateCotaTx, FEE } = require("@nervina-labs/cota-sdk")
const { registryURL, cotaURL, ckbNodeUrl, ckbIndexerUrl } = require('../../utils')
const { waitTxStatus, secp256k1CellDep, getFirstWithdrawCotaNFT, mint, readLog } = require('../../utils/common')
const chai = require('chai')
const expect = require('chai').expect
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);


describe('Transfer-Update test', () => {

  const service = {
    collector: new Collector({ ckbNodeUrl, ckbIndexerUrl }),
    aggregator: new Aggregator({ registryUrl: registryURL, cotaUrl: cotaURL }),
  }
  const ckb = service.collector.getCkb()
  // True for mainnet and false for testnet
  const isMainnet = false

  const TEST_PRIVATE_KEY = '0xb6b97e885d4005938613e1a28060e55ccfc3386d07808658dbdad8bea3cdcd99'
  const TEST_ADDRESS = 'ckt1qyq9ss6yfa6geaf8h094ajuwhukpskzt9uls9mgsam' //AliceStress
  const RECEIVER_ADDRESS = 'ckt1qyqy5pcdq2tx84j6ca3zg3sd56z0t0xsadlsjwm4fj' //Bobs
  const RECEIVER_PRIVATE_KEY = '0x0931b7775cc0806e55c8c54ef74b077dec9003ed848953df1bb7d4824c66936b'
  const OTHER_ADDRESS = 'ckt1qyqzjk6saht5u3r7894kjvhkepl4vpgdqe0savd4zd' //Tom

  let cotaID = '0x160db3c084d6af19dc2a05f70edcd17a81d7e999'
  let getCotaNFT
  let tokenIndex

  before(async () => {
    const mintCotaInfo = {
      cotaId: '0x160db3c084d6af19dc2a05f70edcd17a81d7e999',
      withdrawals: [
        {
          state: '0x00',
          characteristic: '0x050505050505050505050505050505050505AAA0',
          toLockScript: serializeScript(addressToScript(RECEIVER_ADDRESS)),
        },
      ],
    }
    let signedTx = await mint(ckb, service, mintCotaInfo, TEST_ADDRESS, RECEIVER_ADDRESS, TEST_PRIVATE_KEY, isMainnet) // second time run
    let txHash = await ckb.rpc.sendTransaction(signedTx, 'passthrough')
    console.info(`Mint cota nft tx has been sent with tx hash ${txHash}`)
    await waitTxStatus(ckb, txHash)

    getCotaNFT = await getFirstWithdrawCotaNFT(service, cotaID, RECEIVER_ADDRESS)
    tokenIndex = getCotaNFT.tokenIndex
    console.log("tokenindex in before: ", tokenIndex)
  })


  const transferUpdate = async (cotaID, tokenIndex) => {
    const cotaLock = addressToScript(RECEIVER_ADDRESS)
    const withdrawLock = addressToScript(TEST_ADDRESS)

    const transfers = [
      {
        cotaId: cotaID,
        tokenIndex: tokenIndex,
        toLockScript: serializeScript(addressToScript(OTHER_ADDRESS)),
        state: '0x01',
        characteristic: '0x050505050505050505050505050505050505EEEE',
      },
    ]
    console.log(`serializeScript RECEIVER_ADDRESS: ${serializeScript(addressToScript(RECEIVER_ADDRESS))}`)
    console.log(`serializeScript OTHER_ADDRESS: ${serializeScript(addressToScript(OTHER_ADDRESS))}`)
    let rawTx = await generateTransferUpdateCotaTx(service, cotaLock, withdrawLock, transfers, FEE, isMainnet)
    const secp256k1Dep = await secp256k1CellDep(ckb)
    rawTx.cellDeps.push(secp256k1Dep)

    const signedTx = ckb.signTransaction(RECEIVER_PRIVATE_KEY)(rawTx)
    console.log(JSON.stringify(signedTx))
    return signedTx
  }

  const fakeRun = async (cotaID, tokenIndex) => {
    console.log("=====fake run without sending transferUpdate=====")
    await transferUpdate(cotaID, tokenIndex)
  }

  const realRun = async (cotaID, tokenIndex) => {
    console.log("=====real run sending transferUpdate=====")
    let signedTx = await transferUpdate(cotaID, tokenIndex)
    let txHash = await ckb.rpc.sendTransaction(signedTx, 'passthrough')
    console.info(`Transfer and update cota nft tx has been sent with tx hash ${txHash}`)
    return txHash
  }

  const fakeRealRun = async (cotaID, tokenIndex) => {
    await fakeRun(cotaID, tokenIndex)
    return await realRun(cotaID, tokenIndex)
  }


  it('case1: expect sending transferUpdate successfully after fake sending', async () => {
    console.log(`tokenindex in case1: ${cotaID}, ${tokenIndex}`)
    let txHash = await fakeRealRun(cotaID, tokenIndex)
    console.log("sending transferUpdate txHash: ", txHash)
    expect(txHash).not.null
    await expect(realRun(cotaID, tokenIndex)).to.eventually.rejectedWith('PoolRejectedDuplicatedTransaction')
    await waitTxStatus(ckb, txHash)
  })

  it('case2: expect error when transferUpdate with owned non-withdrawl cota nft', async () => {
    tokenIndex = '0x000003c1'
    console.log(`tokenindex in case2: ${cotaID}, ${tokenIndex}`)
    await expect(realRun(cotaID, tokenIndex)).to.eventually.rejectedWith("Cannot destructure property 'smtRootHash' of '(intermediate value)' as it is undefined.")
    readLog("transferUpdate.log", "The cota_id and token_index has not withdrawn");
  })

  // TODO: should report with `has not withdrawn` error after fixed
  it('case3: expect error when transferUpdate with non-owned non-withdrawl cota nft', async () => {
    console.log(`tokenindex in case3: ${cotaID}, ${tokenIndex}`)
    await expect(realRun(cotaID, "0x000003bd")).to.eventually.rejectedWith(
      '{"code":-302,"message":"TransactionFailedToVerify: Verification failed Script(TransactionScriptError { source: Inputs[0].Type, cause: ValidationFailure: see the error code 34 in the page https://nervosnetwork.github.io/ckb-script-error-codes/by-type-hash/89cd8003a0eaf8e65e0c31525b7d1d5c1becefd2ea75bb4cff87810ae37764d8.html#34 })","data":"Verification(Error { kind: Script, inner: TransactionScriptError { source: Inputs[0].Type, cause: ValidationFailure: see the error code 34 in the page https://nervosnetwork.github.io/ckb-script-error-codes/by-type-hash/89cd8003a0eaf8e65e0c31525b7d1d5c1becefd2ea75bb4cff87810ae37764d8.html#34 } })"}')
  })

  it('case4: expect error when transferUpdate with non-existing cotaID nft', async () => {
    await expect(realRun("0x160db3c084d6af19dc2a05f70edcd17a81d7eAAA", "0x00000000")).to.eventually.rejectedWith(
      "Cannot destructure property 'smtRootHash' of '(intermediate value)' as it is undefined.")
    readLog("transferUpdate.log", "The cota_id and token_index has not withdrawn");
  })

})