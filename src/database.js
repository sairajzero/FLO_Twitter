const sqlite3 = require('sqlite3').verbose();

var _db;

function init(db_name) {
    return new Promise((resolve, reject) => {
        const DATABASE_NAME = `./${db_name}.db`;
        _db = new sqlite3.Database(DATABASE_NAME, (err) => {
            if (err) return reject(err);
            _db.serialize(() => {

                _db.run("CREATE TABLE IF NOT EXISTS `Logs` ("
                    + " `userID` CHAR(34) NOT NULL,"
                    + " `request` TEXT NOT NULL,"
                    + " `sign` VARCHAR(160) NOT NULL UNIQUE,"
                    + " `time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
                    + ")");

                _db.run("CREATE TABLE IF NOT EXISTS `Tweets` ("
                    + " `id` VARCHAR(128) NOT NULL PRIMARY KEY,"
                    + " `time` BIGINT NOT NULL,"
                    + " `content` TEXT,"
                    + " `sign` VARCHAR(160) NOT NULL UNIQUE,"
                    + " `retweet_id` VARCHAR(128)"
                    + ")");

                _db.run("CREATE TABLE IF NOT EXISTS `Following`("
                    + " `userID` CHAR(34) NOT NULL PRIMARY KEY,"
                    + " `time` BIGINT NOT NULL,"
                    + " `sign` VARCHAR(160) NOT NULL UNIQUE"
                    + ")");

                _db.run("CREATE TABLE IF NOT EXISTS `Followers` ("
                    + " `userID` CHAR(34) NOT NULL PRIMARY KEY,"
                    + " `time` BIGINT NOT NULL,"
                    + " `sign` VARCHAR(160) NOT NULL UNIQUE"
                    + ")");

                _db.run("CREATE TABLE IF NOT EXISTS `Messages` ("
                    + " `senderID` CHAR(34) NOT NULL,"
                    + " `receiverID` CHAR(34) NOT NULL,"
                    + " `time` BIGINT NOT NULL,"
                    + " `message` TEXT NOT NULL,"
                    + " `sign` VARCHAR(160) NOT NULL UNIQUE"
                    + ")");

                _db.get("SELECT time FROM `Logs` LIMIT 1", (err) => {
                    if (err) return reject(err);
                    _exports.close = _db.close;
                    resolve("Database initiated");
                })
            })
        });
    })
}

function log(userID, request, sign) {
    return new Promise((resolve, reject) => {
        _db.run("INSERT INTO `Logs` (userID, request, sign) VALUES (?,?,?)", [userID, request, sign],
            (err) => err ? reject(err) : resolve(true));
    })
}

function checkDuplicateSign(sign) {
    return new Promise((resolve, reject) => {
        _db.get("SELECT COUNT(*) AS n FROM `Logs` WHERE sign=?", [sign],
            (err, row) => err ? reject(error) : resolve(row.n !== 0))
    });
}

function storeTweet(id, content, time, sign, retweet_id) {
    return new Promise((resolve, reject) => {
        _db.run("INSERT INTO `Tweets` (id, content, time, sign, retweet_id) VALUES (?,?,?,?,?)", [id, content, time, sign, retweet_id],
            (err) => err ? reject(err) : resolve(true));
    })
}

function removeTweet(id, time, sign) {
    return new Promise((resolve, reject) => {
        _db.run("UPDATE `Tweets` SET time=?, sign=?, content=NULL WHERE id=?", [time, sign, id],
            (err) => err ? reject(err) : resolve(true));
    })
}

function getTweet(id) {
    return new Promise((resolve, reject) => {
        _db.get("SELECT * FROM `Tweets` WHERE id=?", [id],
            (err, row) => err ? reject(err) : resolve(row));
    })
}

function getTweets(time) {
    return new Promise((resolve, reject) => {
        _db.all("SELECT * FROM `Tweets` WHERE time>?", [time],
            (err, rows) => err ? reject(err) : resolve(rows));
    })
}

function follow(userID, time, sign) {
    return new Promise((resolve, reject) => {
        _db.get("SELECT userID FROM `Following` WHERE userID=?", [userID], (err, row) => {
            if (err) return reject(err);
            if (row) return resolve(false); //entry already there
            _db.run("INSERT INTO `Following` (userID, time, sign) VALUES (?,?,?)", [userID, time, sign], (err) => err ? reject(err) : resolve(true));
        });
    })
}

function unfollow(userID) {
    return new Promise((resolve, reject) => {
        _db.get("SELECT userID FROM `Following` WHERE userID=?", [userID], (err, row) => {
            if (err) return reject(err);
            if (!row) return resolve(false); //entry not there
            _db.run("DELETE FROM `Following` WHERE userID=?", [userID], (err) => err ? reject(err) : resolve(true));
        });
    })
}

function get_following() {
    return new Promise((resolve, reject) => {
        _db.all("SELECT * FROM `Following`", (err, rows) => err ? reject(err) : resolve(rows));
    })
}


function add_follower(userID, time, sign) {
    return new Promise((resolve, reject) => {
        _db.get("SELECT userID FROM `Followers` WHERE userID=?", [userID], (err, row) => {
            if (err) return reject(err);
            if (row) return resolve(false); //entry already there
            _db.run("INSERT INTO `Followers` (userID, time, sign) VALUES (?,?,?)", [userID, time, sign], (err) => err ? reject(err) : resolve(true));
        });
    })
}

function rm_follower(userID) {
    return new Promise((resolve, reject) => {
        _db.get("SELECT userID FROM `Followers` WHERE userID=?", [userID], (err, row) => {
            if (err) return reject(err);
            if (!row) return resolve(false); //entry not there
            _db.run("DELETE FROM `Followers` WHERE userID=?", [userID], (err) => err ? reject(err) : resolve(true));
        });
    })
}

function get_followers() {
    return new Promise((resolve, reject) => {
        _db.all("SELECT * FROM `Followers`", (err, rows) => err ? reject(err) : resolve(rows));
    })
}

function storeMessage(senderID, receiverID, time, message, sign) {
    return new Promise((resolve, reject) => {
        _db.run("INSERT INTO `Messages` (senderID, receiverID, time, message, sign) VALUES (?,?,?,?,?)", [senderID, receiverID, time, message, sign],
            (err) => err ? reject(err) : resolve({ senderID, receiverID, time, message, sign }));
    })
}

function getMessages(time = 0) {
    return new Promise((resolve, reject) => {
        _db.all("SELECT * FROM `Messages` WHERE time>?", [time],
            (err, rows) => err ? reject(err) : resolve(rows));
    })
}

const _exports = module.exports = {
    init,
    log, checkDuplicateSign,
    storeTweet, removeTweet,
    getTweet, getTweets,
    follow, unfollow,
    get_following,
    add_follower, rm_follower,
    get_followers,
    storeMessage, getMessages
}