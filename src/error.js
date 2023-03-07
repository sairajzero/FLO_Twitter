const eCode = require('../public/scripts/tweeter').errorCode

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