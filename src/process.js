const { INVALID, eCode } = require("./error");
const DB = require("./database");
const keys = require("./keys");

const tweet_id = (content, time) => keys.address_b58 + "_" + bitjs.Base58.encode(Crypto.SHA256(time + content, { asBytes: true }));

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
        DB.follow(target, time, sign)
            .then(result => resolve(result))
            .catch(error => reject(error))
    })
}

function unfollow(target) {
    return new Promise((resolve, reject) => {
        DB.unfollow(target)
            .then(result => resolve(result))
            .catch(error => reject(error))
    })
}

function message_sent(sender, receiver, message, time, sign) {
    return new Promise((resolve, reject) => {
        DB.storeMessage(sender, receiver, time, message, sign)
            .then(result => resolve(result))
            .catch(error => reject(error))
    })
}

/* Public API */
function message_receive(sender, receiver, message, time, sign) {
    return new Promise((resolve, reject) => {
        DB.storeMessage(sender, receiver, time, message, sign)
            .then(result => resolve(result))
            .catch(error => reject(error))
    })
}

function add_follower(follower, time, sign) {
    return new Promise((resolve, reject) => {
        DB.add_follower(follower, time, sign)
            .then(result => resolve(result))
            .catch(error => reject(error))
    })
}

function rm_follower(follower) {
    return new Promise((resolve, reject) => {
        DB.rm_follower(follower)
            .then(result => resolve(result))
            .catch(error => reject(error))
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
    get_user,
    get_tweet, get_tweets,
    get_followers, get_following
}