'use strict';

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

if (process.argv.includes("--trace")) {
    var log = console.log;
    console.log = function () {
        log.apply(console, arguments);
        // Print the stack trace
        console.trace();
    };

    var error = console.error;
    console.error = function () {
        error.apply(console, arguments);
        // Print the stack trace
        console.trace();
    };
}