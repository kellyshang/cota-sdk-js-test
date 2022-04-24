const cota = require("@nervina-labs/cota-sdk")
const expect = require('chai').expect;
const { registryURL, cotaURL } = require('../../utils');
const ckbUtils = require('@nervosnetwork/ckb-sdk-utils');

describe('aggregator test suite', () => {

    const aggregator = new cota.Aggregator({ registryUrl: registryURL, cotaUrl: cotaURL })

    // ignore: cannot return error
    it.skip('[negative] generateRegisterCotaSmt - should return error when lockhash has been registered', async () => {
        let lockHashes = ['0x8a8f45a094cbe050d1a612924901b11edc1bce28c0fd8d96cdc8779889f28aa8']
        let registerCotaSMT = await aggregator.generateRegisterCotaSmt(lockHashes)
        // expect
    })

    it('[positive] generateRegisterCotaSmt - should return SMT info when lockhash has not been registered', async () => {
        var HEX_REGEX = /^[0-9a-fA-F]+$/;
        let lockHashes = ['0xdaf34bb04508dfc7e56d4b66f7162111bd488e8cb52173a51979f064e33d092f']
        const registerCotaSMT = await aggregator.generateRegisterCotaSmt(lockHashes)
        console.log(registerCotaSMT)
        expect(registerCotaSMT.registrySmtEntry).not.null
        expect(registerCotaSMT.registrySmtEntry).include(lockHashes[0].substring(2))
        expect(registerCotaSMT.smtRootHash).not.null
        expect(registerCotaSMT.smtRootHash.length).equal(64)
        expect(registerCotaSMT.registrySmtEntry).to.match(HEX_REGEX)
        expect(registerCotaSMT.smtRootHash).to.match(HEX_REGEX);
    })

    it('[positive] checkReisteredLockHashes - should return true when all lockhashes have been registered ', async () => {
        let lockHashes = ['0x17e158e242413ee0aed9ea99e3399a2006fa36d1311b5cc3de6eecc9e004ecfa',
            '0x40010501bcec4f5092a9735de6688a81ad8b8e69e2a95ce7059e31e0cbd6eaad']
        let checkRegistered = await aggregator.checkReisteredLockHashes(lockHashes)
        expect(checkRegistered.registered).true
    })

    it('[negative] checkReisteredLockHashes - should return false when one lockhash has not been registered ', async () => {
        let lockHashes = ['0x40010501bcec4f5092a9735de6688a81ad8b8e69e2a95ce7059e31e0cbd6eaad',
            '0xdaf34bb04508dfc7e56d4b66f7162111bd488e8cb52173a51979f064e33d092f']
        let checkRegistered = await aggregator.checkReisteredLockHashes(lockHashes)
        expect(checkRegistered.registered).false
    })


})