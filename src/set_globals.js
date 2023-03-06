'use strict';

//fetch for node js (used in floBlockchainAPI.js)
//global.fetch = require("node-fetch"); //node-fetch v2
import fetch from 'node-fetch'; global.fetch = fetch; //node-fetch v3

//Set browser paramaters from param.json (or param-default.json)
var param;
try {
    param = require('../args/param.json');
} catch {
    param = require('../args/param-default.json');
} finally {
    for (let p in param)
        global[p] = param[p];
}

if (!process.argv.includes("--debug"))
    global.console.debug = () => null;
