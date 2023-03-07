(function (EXPORTS) {
    const floTwitter = EXPORTS;

    var self_server_url = 'localhost:8080/';

    function fetch_api(server_uri, apicall, options) {
        return new Promise((resolve, reject) => {
            console.debug(server_uri + apicall);
            (options ? fetch(server_uri + api, options) : fetch(server_uri + api))
                .then(result => resolve(result))
                .catch(error => reject(error))
        })
    }

    function fetch_self(apicall, options) {
        return new Promise((resolve, reject) => {
            fetch_api(self_server_url, apicall, options)
                .then(result => resolve(result))
                .catch(error => reject(error))
        })
    }

    function fetch_target(userID, apicall, options) {
        return new Promise((resolve, reject) => {
            getUserURL(userID).then(target_url => {
                fetch_api(target_url, apicall, options)
                    .then(result => resolve(result))
                    .catch(error => reject(error))
            }).catch(error => reject(error))
        })
    }

    //fn to return onion address of target userID
    function getUserURL(userID) {
        return new Promise((resolve, reject) => {

        })
    }

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
            }).catch(error => CustomError(CustomError.NODES_OFFLINE, error))
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
        keys.forEach(k => { if (typeof reqObj[vals] !== 'undefined') vals.push(k + ":" + reqObj[k]); })
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
        var request = { senderID, pubKey, receiverID, time };
        request.sign = signRequest({ type: "message", senderID, receiverID, message, time });
        console.debug(request);

        const options = {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request)
        }

        return responseParseAll([fetch_target('/message', options), fetch_self(targetID, '/message', options)]);

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

})('object' === typeof module ? module.exports : window.floTwitter = {});