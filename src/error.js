const eCode = {

    INVALID_SERVER: '000',

    //INVALID INPUTS: 0XX
    INVALID_REQUEST_FORMAT: '001',
    MISSING_PARAMETER: '099',
    ACCESS_DENIED: '002',
    INVALID_FLO_ID: '011',
    INVALID_PRIVATE_KEY: '013',
    INVALID_PUBLIC_KEY: '014',
    INVALID_SIGNATURE: '015',
    EXPIRED_SIGNATURE: '016',
    DUPLICATE_SIGNATURE: '017',
    //INCORRECT DATA: 1XX

    //OTHERS
    NODES_OFFLINE: '404',
    INTERNAL_ERROR: '500'
}



const INVALID = function (ecode, message) {
    if (!(this instanceof INVALID))
        return new INVALID(ecode, message);
    this.message = message;
    this.ecode = ecode;
}
INVALID.e_code = 400;
INVALID.prototype.toString = function () {
    return "E" + this.ecode + ": " + this.message;
}
INVALID.str = (ecode, message) => INVALID(ecode, message).toString();

const INTERNAL = function INTERNAL(message) {
    if (!(this instanceof INTERNAL))
        return new INTERNAL(message);
    this.message = message;
}
INTERNAL.e_code = 500;
INTERNAL.prototype.toString = function () {
    return "E" + eCode.INTERNAL_ERROR + ": " + this.message;
}
INTERNAL.str = (ecode, message) => INTERNAL(ecode, message).toString();

module.exports = { INTERNAL, INVALID, eCode, pCode }