var pubkey, flo_address, address_b58, address_hex;

module.exports = {
    set_key(pk) {
        let floID = floCrypto.getFloID(pk)
        if (!floCrypto.verifyPubKey(pk, floID))
            throw "Invalid public key";
        pubkey = pk;
        flo_address = floID;
        let decode = floCrypto.decodeAddr(floID);
        address_hex = decode.hex;
        address_b58 = bitjs.Base58.encode(decode.bytes);
    },
    clear() {
        address_b58 = flo_address = address_hex = pubkey = undefined;
    },
    get pubKey() {
        return pubkey;
    },
    get flo_address() {
        return flo_address;
    },
    get address_b58() {
        return address_b58;
    },
    get address_hex() {
        return address_hex;
    }
}