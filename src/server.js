'use strict';
const express = require('express');
const express_ws = require('express-ws');
const Request = require('./request');
const path = require('path');

const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');

var server = null;
const app = express();
express_ws(app);

// parsing the incoming data
app.use(express.json());
app.use(express.urlencoded({
    extended: true
}));

//serving public file
app.use(express.static(PUBLIC_DIR));

//CORS header
app.use(function (req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', "*");
    // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
    // Request headers you wish to allow
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
    // Pass to next layer of middleware
    next();
})

//self
app.post('/tweet', Request.tweet);
app.post('/untweet', Request.untweet);
app.ws('/message', Request.onmessage);

//all (switch behaviour when self/others)
app.post('/message', Request.message);
app.post('/follow', Request.follow);
app.post('/unfollow', Request.unfollow);

//get(all)
app.get('/tweets', Request.get_tweets);
app.get('/followers', Request.get_followers);
app.get('/following', Request.get_following);

function start(port) {
    return new Promise(resolve => {
        server = app.listen(port, () => {
            resolve(`Server Running at port ${port}`);
        });
    })
}

function stop() {
    return new Promise(resolve => {
        server.close(() => {
            server = null;
            resolve('Server stopped');
        })
    })
}

module.exports = {
    start, stop,
    get server() { return server },
    get app() { return app }
}