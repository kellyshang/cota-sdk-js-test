const { addressToScript, serializeScript, privateKeyToAddress, AddressPrefix } = require('@nervosnetwork/ckb-sdk-utils')
const { generateTransferCotaTx, generateMintCotaTx, generateDefineCotaTx, FEE } = require('@nervina-labs/cota-sdk')
const expect = require('chai').expect

const secp256k1CellDep = async (ckb) => {
    const secp256k1Dep = (await ckb.loadDeps()).secp256k1Dep
    return { outPoint: secp256k1Dep.outPoint, depType: 'depGroup' }
}

const define = async (ckb, service, cotaInfo, TEST_ADDRESS, TEST_PRIVATE_KEY, isMainnet) => {
    const defineLock = addressToScript(TEST_ADDRESS)

    let { rawTx, cotaId } = await generateDefineCotaTx(service, defineLock, 0, '0x00', cotaInfo, FEE, isMainnet)
    console.log(`cotaId: ${cotaId}`)
    const secp256k1Dep = await secp256k1CellDep(ckb)
    rawTx.cellDeps.push(secp256k1Dep)
    const signedTx = ckb.signTransaction(TEST_PRIVATE_KEY)(rawTx)
    console.log('signedTx: ', JSON.stringify(signedTx))
    return { signedTx, cotaId }
}

const mint = async (ckb, service, mintCotaInfo, TEST_ADDRESS, RECEIVER_ADDRESS, TEST_PRIVATE_KEY, isMainnet) => {
    const mintLock = addressToScript(TEST_ADDRESS)
    console.log(`serializeScript RECEIVER_ADDRESS: ${serializeScript(addressToScript(RECEIVER_ADDRESS))}`)
    let rawTx = await generateMintCotaTx(service, mintLock, mintCotaInfo, FEE, isMainnet)

    const secp256k1Dep = await secp256k1CellDep(ckb)
    rawTx.cellDeps.push(secp256k1Dep)

    const signedTx = ckb.signTransaction(TEST_PRIVATE_KEY)(rawTx)
    return signedTx
}

const transfer = async (ckb, service, cotaId, tokenIndex, TEST_ADDRESS, RECEIVER_ADDRESS, OTHER_ADDRESS, RECEIVER_PRIVATE_KEY, isMainnet) => {
    const cotaLock = addressToScript(RECEIVER_ADDRESS)
    const withdrawLock = addressToScript(TEST_ADDRESS)

    const transfers = [
        {
            cotaId: cotaId,
            tokenIndex: tokenIndex,
            toLockScript: serializeScript(addressToScript(OTHER_ADDRESS)),
        },
    ]
    console.log(`serializeScript RECEIVER_ADDRESS: ${serializeScript(addressToScript(RECEIVER_ADDRESS))}`)
    console.log(`serializeScript OTHER_ADDRESS: ${serializeScript(addressToScript(OTHER_ADDRESS))}`)
    let rawTx = await generateTransferCotaTx(service, cotaLock, withdrawLock, transfers, FEE, isMainnet)

    const secp256k1Dep = await secp256k1CellDep(ckb)
    rawTx.cellDeps.push(secp256k1Dep)

    const signedTx = ckb.signTransaction(RECEIVER_PRIVATE_KEY)(rawTx)
    return signedTx
}

const sleep = (s) => {
    return new Promise((resolve) => setTimeout(resolve, 1000 * s));
}

const waitTxStatus = async (ckb, txHash) => {
    let time_seconds = 0
    while (true) {
        await sleep(3)
        let checkStatus = await ckb.rpc.getTransaction(txHash)
        if (checkStatus.txStatus.status != "committed" && checkStatus.txStatus.status != "rejected") {
            console.log(`tx status: ${checkStatus.txStatus.status}`)
            console.log(`tx has not on chain, ${time_seconds} seconds passed`)
            time_seconds += 3
            continue
        }
        console.log(`tx is onchain! onchain tx status: ${checkStatus.txStatus.status}`)
        await sleep(3)
        return
    }
}

const getFirstWithdrawCotaNFT = async (service, cotaId, RECEIVER_ADDRESS) => {
    let cotaID = cotaId
    const cotaNFTs = await service.aggregator.getWithdrawCotaNft({
        lockScript: serializeScript(addressToScript(RECEIVER_ADDRESS)),
        page: 0,
        pageSize: 200,
        cotaId: cotaID,
    })

    let tokenIndex
    console.log(`cotaNFTs.length: ${cotaNFTs.nfts.length}`)
    if (cotaNFTs.nfts.length > 0) {
        tokenIndex = cotaNFTs.nfts[0].tokenIndex
        console.log(`withdrawl tokenIndex: ${JSON.stringify(tokenIndex)}`)
    }
    return { cotaID, tokenIndex }
}

const getFirstHoldCotaNFT = async (service, cotaId, TEST_ADDRESS) => {
    let cotaID = cotaId
    const cotaNFTs = await service.aggregator.getHoldCotaNft({
        lockScript: serializeScript(addressToScript(TEST_ADDRESS)),
        page: 0,
        pageSize: 200,
        cotaId: cotaID,
    })

    let tokenIndex
    console.log(`cotaNFTs.length: ${cotaNFTs.nfts.length}`)
    if (cotaNFTs.nfts.length > 0) {
        tokenIndex = cotaNFTs.nfts[0].tokenIndex
        console.log(`hold tokenIndex: ${JSON.stringify(tokenIndex)}`)
    }
    return { cotaID, tokenIndex }
}

const getTokenIssued = async (service, cotaId) => {
    let cotaID = cotaId
    const defineInfo = await service.aggregator.getDefineInfo({
        cotaId: cotaID,
    })
    console.log(`defineInfo is: ${JSON.stringify(defineInfo)}`)
    let tokenIssued = defineInfo.issued
    return tokenIssued
}

const generatePrivAddr = () => {
    var crypto = require('crypto')
    var privkey = '0x' + crypto.randomBytes(32).toString("hex")
    console.log('privkey: ', privkey)
    var addrTestnet = privateKeyToAddress(privkey, {
        prefix: AddressPrefix.Testnet,
    })
    console.log('addr(testnet): ', addrTestnet)
    return { privkey, addrTestnet }
}

const readLog = (logfile, expectErr) => {
    let fs = require('fs');
    console.log(`the logfile is: ${logfile}`)
    fs.readFile(`./log/${logfile}`, function (err, file) {
        if (err) {
            console.error(err.stack);
            expect(err.stack).to.equal(`please run with 2>${logfile} at the command end`)
            return;
        }
        data = file.toString()

        let errorMsg = expectErr
        if (!file.toString().includes(errorMsg)) {
            console.debug("!!! Didn't match the expected error! Please check the output log.")
            expect.fail(file.toString(), errorMsg, "missmatch expected error!")
        }
    });
}

module.exports = {
    secp256k1CellDep,
    define,
    mint,
    transfer,
    waitTxStatus,
    getFirstWithdrawCotaNFT,
    getFirstHoldCotaNFT,
    getTokenIssued,
    generatePrivAddr,
    readLog,
}
