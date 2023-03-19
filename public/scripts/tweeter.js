(function (EXPORTS) {
    const floTwitter = EXPORTS;

    var host_url = typeof window != 'undefined' ? window.location.origin : undefined;

    const extractURL = url => ['http://', 'https://', '/'].reduce((a, p) => a.replace(p, ''), url);

    const PROTOCOL_HTTP = 'http',
        PROTOCOL_HTTPS = 'https',
        PROTOCOL_WS = 'ws',
        PROTOCOL_WSS = 'wss';

    function decodeURL(url) {
        let protocol, origin;
        if (url.startsWith(PROTOCOL_HTTP) || url.startsWith(PROTOCOL_WS))
            protocol = PROTOCOL_HTTP;
        else if (url.startsWith(PROTOCOL_HTTPS) || url.startsWith(PROTOCOL_WSS))
            protocol = PROTOCOL_HTTPS;
        else
            protocol = PROTOCOL_HTTP; //Default protocol
        origin = extractURL(url);
        return { protocol, origin }
    }

    function constructURL(protocol, origin, api = '') {
        if (!api.startsWith('/'))
            api = '/' + api;
        return protocol + "://" + origin + api;
    }

    function encodeURL_http(url, api = '/') {
        let decoded_url = decodeURL(url);
        return constructURL(decoded_url.protocol, decoded_url.origin, api);
    }

    function encodeURL_ws(url, api = '/') {
        let decoded_url = decodeURL(url);
        var ws_protocol = decoded_url.protocol === PROTOCOL_HTTPS ? PROTOCOL_WSS : PROTOCOL_WS;
        return constructURL(ws_protocol, decoded_url.origin, api);
    }

    function fetch_api(server_uri, api_uri, options) {
        return new Promise((resolve, reject) => {
            let url = encodeURL_http(server_uri, api_uri)
            console.debug(url);
            (options ? fetch(url, options) : fetch(url))
                .then(result => resolve(result))
                .catch(error => reject(error))
        })
    }

    function fetch_self(api_uri, options) {
        return new Promise((resolve, reject) => {
            fetch_api(host_url, api_uri, options)
                .then(result => resolve(result))
                .catch(error => reject(error))
        })
    }

    function fetch_target(userID, api_uri, options) {
        return new Promise((resolve, reject) => {
            getUserURL(userID).then(target_url => {
                fetch_api(target_url, api_uri, options)
                    .then(result => resolve(result))
                    .catch(error => reject(error))
            }).catch(error => reject(error))
        })
    }

    //fn to return onion address of target userID
    function getUserURL(userID) {
        return new Promise((resolve, reject) => {
            compactIDB.readData("users", userID).then(result => {
                if (result) {
                    let target_url = result.address;
                    if (!target_url.match('http://'))
                        resolve(target_url);
                } else
                    reject(CustomError(CustomError.BAD_RESPONSE_CODE, "UserID not found in IDB", errorCode.USER_NOT_FOUND))
            })
        })
    }

    const errorCode = floTwitter.errorCode = {

        INVALID_SERVER: '000',

        //INVALID INPUTS: 0XX
        INVALID_REQUEST_FORMAT: '001',
        ACCESS_DENIED: '002',
        INVALID_FLO_ID: '011',
        INVALID_CHARACTERS: '012',
        INVALID_PRIVATE_KEY: '013',
        INVALID_PUBLIC_KEY: '014',
        INVALID_SIGNATURE: '015',
        EXPIRED_SIGNATURE: '016',
        DUPLICATE_SIGNATURE: '017',
        MISSING_PARAMETER: '099',

        //INCORRECT DATA: 1XX
        USER_NOT_FOUND: '100',

        //OTHERS
        NODES_OFFLINE: '404',
        INTERNAL_ERROR: '500'
    };

    const parseErrorCode = floTwitter.parseErrorCode = function (message) {
        let code = message.match(/^E\d{3}:/g);
        if (!code || !code.length)
            return null;
        else
            return code[0].substring(1, 4);
    }

    function CustomError(status, message, code = null) {
        if (this instanceof CustomError) {
            this.code = code || parseErrorCode(message);
            this.message = message.replace(/^E\d{3}:/g, '').trim();
            this.status = status;
        } else
            return new CustomError(status, message, code);
    }

    CustomError.BAD_REQUEST_CODE = 400;
    CustomError.BAD_RESPONSE_CODE = 500;
    CustomError.NODES_OFFLINE_CODE = 404;

    function responseParse(res, json_ = true) {
        return new Promise((resolve, reject) => {
            res.then(response => {
                if (!response.ok)
                    response.text()
                        .then(result => reject(CustomError(response.status, result)))
                        .catch(error => reject(CustomError(response.status, error)));
                else if (json_)
                    response.json()
                        .then(result => resolve(result))
                        .catch(error => reject(CustomError(CustomError.BAD_RESPONSE_CODE, error)));
                else
                    response.text()
                        .then(result => resolve(result))
                        .catch(error => reject(CustomError(CustomError.BAD_RESPONSE_CODE, error)));
            }).catch(error => CustomError(CustomError.NODES_OFFLINE, error.toString()))
        });
    }

    function responseParseAll(resArr, jsonRes = true) {
        return new Promise((resolve, reject) => {
            Promise.allSettled(resArr.map(res => responseParse(res, jsonRes))).then(result => {
                let failed = result.filter(r => r.status === 'rejected').map(r => r.reason);
                if (failed.length) console.error(failed);
                console.debug(result.filter(r => r.status === 'fulfilled').map(r => r.value));
                if (result[0].status == 'rejected')
                    reject(result[0].reason);
                else resolve(result[0].value);
            }).catch(error => reject(error))
        })
    }

    const reqObj2Str = floTwitter.reqObj2Str = function (reqObj) {
        let keys = Object.keys(reqObj).sort();
        let vals = [];
        keys.forEach(k => { if (typeof reqObj[k] !== 'undefined') vals.push(k + ":" + reqObj[k]); })
        return vals.join("|")
    }

    const signRequest = floTwitter.signRequest = function (request) {
        let req_str = reqObj2Str(request);
        return floDapps.user.sign(req_str);
    }

    floTwitter.tweet = function (content, retweet_id) {
        let time = Date.now(),
            userID = floDapps.user.id,
            pubKey = floDapps.user.public;
        var request = { userID, pubKey, content, retweet_id, time };
        request.sign = signRequest({ type: "tweet", content, time, retweet_id });
        request.pubKey = floDapps.user.public;
        console.debug(request);

        return responseParse(fetch_self('/tweet', {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request)
        }));
    }

    floTwitter.untweet = function (tweet_id) {
        let time = Date.now(),
            userID = floDapps.user.id,
            pubKey = floDapps.user.public;
        var request = { userID, pubKey, tweet_id, time };
        request.sign = signRequest({ type: "untweet", tweet_id, time });
        console.debug(request);

        return responseParse(fetch_self('/untweet', {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request)
        }));
    }

    floTwitter.follow = function (targetID) {
        let time = Date.now(),
            userID = floDapps.user.id,
            pubKey = floDapps.user.public;
        var request = { userID, pubKey, targetID, time };
        request.sign = signRequest({ type: "follow", userID, targetID, time });
        console.debug(request);

        const options = {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request)
        }

        return responseParseAll([fetch_self('/follow', options), fetch_target(targetID, '/follow', options)]);
    }

    floTwitter.unfollow = function (targetID) {
        let time = Date.now(),
            userID = floDapps.user.id,
            pubKey = floDapps.user.public;
        var request = { userID, pubKey, targetID, time };
        request.sign = signRequest({ type: "unfollow", userID, targetID, time });
        console.debug(request);

        const options = {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request)
        }

        return responseParseAll([fetch_self('/unfollow', options), fetch_target(targetID, '/unfollow', options)]);
    }

    floTwitter.message = function (receiverID, message) {
        let time = Date.now(),
            senderID = floDapps.user.id,
            pubKey = floDapps.user.public;
        var request = { senderID, pubKey, receiverID, message, time };
        request.sign = signRequest({ type: "message", senderID, receiverID, message, time });
        console.debug(request);

        const options = {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request)
        }

        return responseParseAll([fetch_target(receiverID, '/message', options), fetch_self('/message', options)]);

    }

    floTwitter.getTweets = function (userID, time = undefined) {
        let api = '/tweets' + (time ? '?time=' + time : "");
        if (userID == floDapps.user.id)
            return responseParse(fetch_self(api));
        else
            return responseParse(fetch_target(userID, api));
    }

    const getTweetUserID = floTwitter.getTweetUserID = tweet_id => floCrypto.rawToFloID(bitjs.Base58.decode(tweet_id.split('_')[0]))

    floTwitter.getTweet = function (tweet_id) {
        let api = '/tweets?id=' + tweet_id;
        let userID = getTweetUserID(tweet_id);
        if (userID == floDapps.user.id)
            return responseParse(fetch_self(api));
        else
            return responseParse(fetch_target(userID, api));
    }

    floTwitter.getFollowerList = function (userID = floDapps.user.id) {
        if (userID == floDapps.user.id)
            return responseParse(fetch_self('/followers'));
        else
            return responseParse(fetch_target(userID, '/followers'));
    }

    floTwitter.getFollowingList = function (userID = floDapps.user.id) {
        if (userID == floDapps.user.id)
            return responseParse(fetch_self('/following'));
        else
            return responseParse(fetch_target(userID, '/following'));
    }

    const validateName = floTwitter.validateName = function (name) {
        return (typeof name === 'string') &&
            /^[\w ]+$/.test(name) &&
            !floCrypto.validateAddr(name);
    }

    const USER_REG_KEY = 'user_register';

    floTwitter.registerUser = function (userID, name, address, privateKey) {
        return new Promise((resolve, reject) => {
            let user_floID = floCrypto.toFloID(userID);
            if (floCrypto.verifyPrivKey(privateKey, user_floID))
                return reject(CustomError(CustomError.BAD_REQUEST_CODE, "Invalid Private key", errorCode.INVALID_PRIVATE_KEY))
            if (!validateName(name))
                return reject(CustomError(CustomError.BAD_REQUEST_CODE, "Invalid name", errorCode.INVALID_CHARACTERS))
            let words = name.toLowerCase().split(' ');
            let receivers = words.map(w => floCrypto.hashID(w));
            let pubkey = floCrypto.getPubKeyHex(privateKey);
            let data = JSON.stringify({ [floGlobals.application]: { [USER_REG_KEY]: { id: userID, name, pubkey, address } } })
            floBlockchainAPI.writeDataMultiple([privateKey], data, receivers)
                .then(result => resolve(result))
                .catch(error => reject(error))
        })
    }

    floTwitter.searchUsers = function (name) {
        return new Promise((resolve, reject) => {
            if (!validateName(name))
                return reject(CustomError(CustomError.BAD_REQUEST_CODE, "Invalid name", errorCode.INVALID_CHARACTERS))
            let words = name.toLowerCase().split(' ');
            let search_ids = words.map(w => floCrypto.hashID(w)),
                application = floGlobals.application;
            floBlockchainAPI.readData(search_ids.join(','), { pattern: application, tx: true }).then(result => {
                var search_result = [], highest_match = 0;
                for (let tx of result.data) {
                    var content = JSON.parse(tx.data)[application];
                    if (USER_REG_KEY in content) {
                        let { id, name, pubkey, address } = content[USER_REG_KEY];
                        let user_floID = floCrypto.toFloID(id);
                        if (tx.senders.has(user_floID)) {
                            let match = search_ids.reduce((a, e) => tx.receivers.has(e) ? ++a : a, 0);
                            if (match == 0 || match < highest_match) //Do nothing
                                continue;
                            if (match == highest_match) //match is same, append user profile to list
                                search_result.push({ id, name, pubkey, address });
                            else if (match > highest_match) { //match is higher than current list, replace the list
                                search_result = [{ id, name, pubkey, address }];
                                highest_match = match;
                            }
                        }
                    }
                }
                resolve(search_result);
            }).catch(error => reject(error))
        })
    }

    const getUser = floTwitter.getUser = function (userID) {
        return new Promise((resolve, reject) => {
            if (!floCrypto.validateAddr(userID))
                return reject(CustomError.BAD_REQUEST_CODE, "Invalid userID", errorCode.INVALID_FLO_ID);
            let user_floID = floCrypto.toFloID(userID),
                application = floGlobals.application;
            compactIDB.readData("lastTx", user_floID).then(lastTx => {
                floBlockchainAPI.readData(user_floID, {
                    ignoreOld: lastTx,
                    sentOnly: true,
                    pattern: application
                }).then(result => {
                    let user_details;
                    for (let i in result.data) {
                        var content = JSON.parse(result.data[i])[application];
                        if (USER_REG_KEY in content) {
                            if (floCrypto.isSameAddr(content[USER_REG_KEY].id, user_floID)) {
                                user_details = {
                                    id: content[USER_REG_KEY].id,
                                    name: content[USER_REG_KEY].name,
                                    address: content[USER_REG_KEY].address,
                                }
                            }
                        }
                    }
                    compactIDB.writeData("lastTx", result.totalTxs, user_floID).then(result => {
                        if (user_details) //new user details found in blockchain, write and resolve the details
                            compactIDB.writeData("users", user_details, user_floID)
                                .then(result => resolve(user_details)).catch(error => reject(error))
                        else //no new user details found in blockchain, check in IDB then resolve/reject if found
                            compactIDB.readData("users", user_floID).then(user_details => {
                                if (user_details)
                                    resolve(user_details);
                                else
                                    reject(CustomError(CustomError.BAD_RESPONSE_CODE, "User not found", errorCode.USER_NOT_FOUND))
                            })
                    }).catch(error => reject(error))
                }).catch(error => reject(error))
            }).catch(error => reject(error))
        })
    }

    function initUserDB() {
        return new Promise((resolve, reject) => {
            var obj = {
                tweets: {},
                messages: {},
                addresses: {},
                users: {},
                lastTx: {},
                appendix: {},
                userSettings: {}
            }
            let user_db = `${floGlobals.application}_${floCrypto.toFloID(floDapps.user.id)}`;
            compactIDB.initDB(user_db, obj).then(result => {
                compactIDB.setDefaultDB(user_db);
                resolve("floTwitter UserDB Initated Successfully")
            }).catch(error => reject(error));
        })
    }

    floTwitter.init = function () {
        return new Promise((resolve, reject) => {
            initUserDB().then(result => {
                getUser(floDapps.user.id).then(details => {
                    responseParse(fetch_self('/user')).then(server => {
                        if (floCrypto.isSameAddr(server.floID, floDapps.user.id)) {
                            if (extractURL(details.address) === extractURL(host_url))
                                resolve(details);
                            else resolve(false); //registered address is different from current
                        } else
                            reject(CustomError(CustomError.BAD_REQUEST_CODE, "Incorrect Server", errorCode.ACCESS_DENIED))
                    }).catch(error => reject(error))
                }).catch(error => {
                    if (error instanceof CustomError && error.code === errorCode.USER_NOT_FOUND)
                        return resolve(null);   //user not registered
                    else reject(error);
                })
            }).catch(error => reject(error))
        })
    }

})('object' === typeof module ? module.exports : window.floTwitter = {});