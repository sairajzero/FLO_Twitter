'use strict';
const { INTERNAL, INVALID, eCode } = require("./error");
const DB = require("./database");
const process = require('./process');
const keys = require("./keys");

const SIGN_EXPIRE_TIME = 5 * 60 * 1000; //5mins

function getRequest(res, rText, callback) {
    callback().then(result => {
        res.send(result);
    }).catch(error => {
        if (error instanceof INVALID)
            res.status(INVALID.e_code).send(error.toString());
        else {
            console.error(error);
            res.status(INTERNAL.e_code).send(INTERNAL.str(rText + " failed! Try again later!"));
        }
    })
}

function processRequest(res, privateAccess, userID, pubKey, sign, rText, validateObj, callback, log = true) {
    validateRequest(validateObj, privateAccess, sign, userID, pubKey).then(req_str => {
        callback().then(result => {
            if (log) DB.log(userID, req_str, sign);
            res.send(result);
        }).catch(error => {
            if (error instanceof INVALID)
                res.status(INVALID.e_code).send(error.toString());
            else {
                console.error(error);
                res.status(INTERNAL.e_code).send(INTERNAL.str(rText + " failed! Try again later!"));
            }
        })
    }).catch(error => {
        if (error instanceof INVALID)
            res.status(INVALID.e_code).send(error.toString());
        else {
            console.error(error);
            res.status(INTERNAL.e_code).send(INTERNAL.str("Request processing failed! Try again later!"));
        }
    })
}

function validateRequest(request, privateAccess, sign, userID, pubKey) {
    return new Promise((resolve, reject) => {
        if (typeof request !== "object")
            reject(INVALID(eCode.INVALID_REQUEST_FORMAT, "Request is not an object"));
        else if (!request.time)
            reject(INVALID(eCode.MISSING_PARAMETER, "Timestamp parameter missing"));
        else if (Date.now() - SIGN_EXPIRE_TIME > request.time)
            reject(INVALID(eCode.EXPIRED_SIGNATURE, "Signature Expired"));
        else if (privateAccess && pubKey !== keys.pubKey)
            reject(INVALID(eCode.ACCESS_DENIED, "Access Denied"));
        else if (!floCrypto.validateAddr(userID)) //validateFloID to limit to floID users only
            reject(INVALID(eCode.INVALID_FLO_ID, "Invalid userID"));
        else if (!floCrypto.verifyPubKey(pubKey, userID))
            reject(INVALID(eCode.INVALID_PUBLIC_KEY, "Invalid public key"));
        else {
            let req_str = Object.keys(request).sort().map(r => r + ":" + request[r]).join("|");
            try {
                if (!floCrypto.verifySign(req_str, sign, signKey))
                    reject(INVALID(eCode.INVALID_SIGNATURE, "Invalid request signature"));
                else DB.checkDuplicateSign(sign).then(duplicate => {
                    if (duplicate.length)
                        reject(INVALID(eCode.DUPLICATE_SIGNATURE, "Duplicate signature"));
                    else
                        resolve(req_str);
                }).catch(error => reject(error))
            } catch {
                reject(INVALID(eCode.INVALID_SIGNATURE, "Corrupted sign/key"));
            }
        }
    });
}

function processRequest_split(res, senderID, targetID, pubKey, sign, rText, validateObj, callback_priv, callback_pub, log = true) {
    if (pubKey === keys.pubKey)
        processRequest(res, true, senderID, pubKey, sign, rText, validateObj, callback_priv, log);
    else if (floCrypto.isSameAddr(targetID, keys.flo_address))
        processRequest(res, false, senderID, pubKey, sign, rText, validateObj, callback_pub, log);
    else res.status(INVALID.e_code).send(INVALID.str(eCode.ACCESS_DENIED, "Invalid target node"));
}

function tweet(req, res) {
    let { userID, pubKey, content, time, sign, retweet_id } = req.body;
    processRequest(res, true, userID, pubKey, sign, "Tweet", { type: "tweet", content, time, retweet_id },
        () => process.tweet(content, time, sign, retweet_id));
}

function untweet(req, res) {
    let { userID, pubKey, tweet_id, time, sign } = req.body;
    processRequest(res, true, userID, pubKey, sign, "UnTweet", { type: "untweet", tweet_id, time },
        () => process.untweet(tweet_id, time, sign));
}

function follow(req, res) {
    let { userID, targetID, pubKey, time, sign } = req.body;
    processRequest_split(res, userID, targetID, pubKey, sign, "Follow", { type: "follow", userID, targetID, time },
        () => process.follow(targetID, time, sign),
        () => process.add_follower(userID, time, sign)
    );
}

function unfollow(req, res) {
    let { userID, targetID, pubKey, time, sign } = req.body;
    processRequest_split(res, userID, targetID, pubKey, sign, "Unfollow", { type: "unfollow", userID, targetID, time },
        () => process.unfollow(targetID),
        () => process.rm_follower(userID)
    );
}

function message(req, res) {
    let { senderID, receiverID, pubKey, message, time, sign } = req.body;
    processRequest_split(res, senderID, receiverID, pubKey, sign, "Message", { type: "message", senderID, receiverID, message, time },
        () => process.message_sent(senderID, receiverID, message, time, sign),
        () => process.message_receive(senderID, receiverID, message, time, sign)
    );
}

function get_user(req, res) {
    getRequest(res, "Get User ID", () => process.get_user());
}

function get_tweets(req, res) {
    let { id, time } = req.query;
    if (typeof id !== 'undefined')
        getRequest(res, "Get Tweet", () => process.get_tweet(id));
    else {
        if (!Number.isInteger(time) || time < 0)
            time = 0;
        getRequest(res, "Get Tweets", () => process.get_tweets(time));
    }
}

function get_followers(req, res) {
    getRequest(res, "Get followers", () => process.get_followers);
}

function get_following(req, res) {
    getRequest(res, "Get following", () => process.get_following);
}

module.exports = {
    tweet, untweet,
    follow, unfollow,
    message,
    get_user,
    get_tweets,
    get_followers, get_following
}
