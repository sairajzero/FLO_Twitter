const { INVALID, eCode } = require("./error");
const DB = require("./database");
const keys = require("./keys");
const websocket = require('ws')

const tweet_id = (content, time) => keys.address_b58 + "_" + bitjs.Base58.encode(Crypto.SHA256(time + content, { asBytes: true }));

const ws_conns = [];

/* Private API*/
function tweet(content, time, sign, retweet_id) {
    return new Promise((resolve, reject) => {
        let id = tweet_id(content, time);
        DB.storeTweet(id, content, time, sign, retweet_id)
            .then(result => resolve({ tweet_id: id }))
            .catch(error => reject(error))
    })
}

function untweet(id, time, sign) {
    return new Promise((resolve, reject) => {
        DB.removeTweet(id, time, sign)
            .then(result => resolve(result))
            .catch(error => reject(error))
    })
}

function follow(target, time, sign) {
    return new Promise((resolve, reject) => {
        DB.follow(target, time, sign).then(result => {
            if (!result)
                reject(INVALID(eCode.DUPLICATE_ENTRY, "Already following"));
            else resolve(result);
        }).catch(error => reject(error))
    })
}

function unfollow(target) {
    return new Promise((resolve, reject) => {
        DB.unfollow(target).then(result => {
            if (!result)
                reject(INVALID(eCode.ENTRY_NOT_FOUND, "Not following"));
            else resolve(result);
        }).catch(error => reject(error))
    })
}

function message_sent(sender, receiver, message, time, sign) {
    return new Promise((resolve, reject) => {
        DB.storeMessage(sender, receiver, time, message, sign).then(result => {
            ws_conns.forEach(ws => ws.send(result)); //forward to all websockets
            resolve(true);
        }).catch(error => reject(error))
    })
}

function get_messages(time) {
    return new Promise((resolve, reject) => {
        DB.getMessages(time)
            .then(result => resolve(result))
            .catch(error => reject(error))
    })
}

function sync_messages(time, ws) {
    console.debug("instance", ws instanceof websocket.WebSocket, ws instanceof websocket)
    if (!(ws instanceof websocket.WebSocket))
        return;
    get_messages(time).then(result => {
        if (ws.readyState === ws.OPEN)
            result.forEach(d => ws.send(d));
    }).catch(error => reject(error));
    ws_conns.push(ws);
    ws.on('close', () => { //remove ws from container when ws is closed
        let i = ws_conns.indexOf(ws);
        if (i !== -1)
            ws_conns.splice(i, 1);
    })
}

/* Public API */
function message_receive(sender, receiver, message, time, sign) {
    return new Promise((resolve, reject) => {
        DB.storeMessage(sender, receiver, time, message, sign).then(result => {
            ws_conns.forEach(ws => ws.send(result)); //forward to all websockets
            resolve(true);
        }).catch(error => reject(error))
    })
}

function add_follower(follower, time, sign) {
    return new Promise((resolve, reject) => {
        DB.add_follower(follower, time, sign).then(result => {
            if (!result)
                reject(INVALID(eCode.DUPLICATE_ENTRY, "Already a follower"));
            else resolve(result);
        }).catch(error => reject(error))
    })
}

function rm_follower(follower) {
    return new Promise((resolve, reject) => {
        DB.rm_follower(follower).then(result => {
            if (!result)
                reject(INVALID(eCode.ENTRY_NOT_FOUND, "Not a follower"));
            else resolve(result);
        }).catch(error => reject(error))
    })
}

/* Get API */
function get_user() {
    return new Promise((resolve, reject) => {
        let floID = keys.flo_address, pubKey = keys.pubKey;
        if (!floID)
            reject("Server user (public key) not configured");
        else
            resolve({ floID, pubKey });
    })
}

function get_tweet(id) {
    return new Promise((resolve, reject) => {
        DB.getTweet(id)
            .then(result => resolve(result))
            .catch(error => reject(error))
    })
}

function get_tweets(time) {
    return new Promise((resolve, reject) => {
        DB.getTweets(time)
            .then(result => resolve(result))
            .catch(error => reject(error))
    })
}

function get_followers() {
    return new Promise((resolve, reject) => {
        DB.get_followers()
            .then(result => resolve(result))
            .catch(error => reject(error))
    })
}

function get_following() {
    return new Promise((resolve, reject) => {
        DB.get_following()
            .then(result => resolve(result))
            .catch(error => reject(error))
    })
}

module.exports = {
    tweet, untweet,
    follow, unfollow,
    add_follower, rm_follower,
    message_sent, message_receive,
    get_messages, sync_messages,
    get_user,
    get_tweet, get_tweets,
    get_followers, get_following
}