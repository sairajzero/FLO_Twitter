'use strict';
global.floGlobals = require('../public/scripts/floGlobals');
require('./set_globals');
require('../public/scripts/lib');
global.floCrypto = require('../public/scripts/floCrypto');
global.floBlockchainAPI = require('../public/scripts/floBlockchainAPI');

const DB = require('./database');
const keys = require('./keys');
const server = require('./server');

(function () {
    var pubkey, port = 8080;
    for (let arg of process.argv) {
        if (/^-u=/i.test(arg) || /^-user=/i.test(arg))
            pubkey = arg.split(/=(.*)/s)[1];
        if (/^-p=/i.test(arg) || /^-port=/i.test(arg))
            pubkey = arg.split(/=(.*)/s)[1];
    }
    if (pubkey) {
        try {
            keys.set_key(pubkey);
            if (!keys.flo_address)
                return console.error("Invalid user");
            DB.init(keys.flo_address).then(result => {
                server.start(port)
                    .then(result => console.log(result))
                    .catch(error => console.error(error))
            }).catch(error => reject(error))
        } catch (error) {
            console.error(error)
        }
    } else
        console.error("Public key parameter required")
})();
