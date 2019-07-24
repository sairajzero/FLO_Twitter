var profiles, following;
var selfWebsocket,followingWebSockets = [];
var privKey, modSuperNode, selfID;

function viewHome(){
  if( sessionStorage.profiles === undefined || sessionStorage.privKey === undefined || sessionStorage.selfID === undefined || sessionStorage.serverPass === undefined || sessionStorage.superNodeList === undefined ){
    alert("Login credentials failed! Returning to login page!");
    window.location.href = "index.html";
    return;
  }
  profiles = JSON.parse(sessionStorage.profiles);
  console.log(profiles);
  privKey = encrypt.retrieveShamirSecret(JSON.parse(sessionStorage.privKey));
  selfID = sessionStorage.selfID;
  superNodeList = new Set(JSON.parse(sessionStorage.superNodeList));
  if(superNodeList.has(selfID)){
    modSuperNode = true;
    setInterval(reloadInitData, 3600000);
  }
  kBucketObj.launchKBucket().then(result => {
    console.log(result);
    initselfWebSocket();
    listProfiles();
    pingSuperNodeforNewMsgs();
    getFollowinglistFromIDB().then(result => {
      following = result;
      if(!following.includes(selfID))
        following.push(selfID);
      console.log(following);
      displayTweetsFromIDB().then(result => {
        connectToAllFollowing();
      }).catch(error => {
      console.log(error);
      })
    }).catch(error => {
        console.log(error);
    })  
  }).catch(error => {
    console.log(error);
  });
}

function initselfWebSocket(){
  selfWebsocket = new WebSocket("ws://"+location.host+"/ws");
  selfWebsocket.onopen = (event) => { 
    console.log("Connecting");
    var serverPass = encrypt.retrieveShamirSecret(JSON.parse(sessionStorage.serverPass));
    selfWebsocket.send("$"+serverPass);
  };
  selfWebsocket.onclose = (event) => { 
    console.log("DISCONNECTED");
    initselfWebSocket();
  };
  selfWebsocket.onmessage = (event) => {
    console.log(event.data); 
    if(event.data[0] == '$')
      return;
    try{
        data = JSON.parse(event.data);
        if(data.follow && encrypt.verify(selfID, data.sign, profiles[data.floID].pubKey)){
          var idb = indexedDB.open("FLO_Tweet");
          idb.onsuccess = (event) => {
            var db = event.target.result;
            var obs = db.transaction("followers", "readwrite").objectStore("followers");
            obs.add(data.sign,data.floID);
            db.close();
          };
          selfWebsocket.send(`F${data.floID}`);
        }else if(data.unfollow && encrypt.verify(selfID, data.sign, profiles[data.floID].pubKey)){
          var idb = indexedDB.open("FLO_Tweet");
          idb.onsuccess = (event) => {
            var db = event.target.result;
            var obs = db.transaction("followers", "readwrite").objectStore("followers");
            obs.delete(data.floID);
            db.close();
          };
          selfWebsocket.send(`U${data.floID}`);
        }else if(data.message && data.to == selfID){
          var msg = encrypt.decryptMessage(data.secret,data.pubVal)
          if(encrypt.verify(msg,data.sign,profiles[data.from].pubKey))
            storeMsg({time:data.time,floID:data.from,text:msg,type:'R'});
        }else if(data.fromSuperNode && following.includes(data.floID)){
          var tid = data.tid;
          data = JSON.parse(data.data);
          if(encrypt.verify(data.tweet,data.sign,profiles[data.floID].pubKey)){
            storeTweet({floID:data.floID,time:data.time,data:data.tweet},tid);
            createTweetElement(data.floID,data.time,data.tweet);
          }
        }else if(modSuperNode){
          superNodeMode(data);
        }
    }catch(error){
        console.log(error);
    } 
  };
  selfWebsocket.onerror = (event) => { console.log(event) };
}

function listProfiles(){
  console.log("listProfiles");
  document.getElementById("profileName").innerHTML=profiles[selfID].name;
  document.getElementById("profileFloID").innerHTML='@'+selfID;
  var profileList =  document.getElementById("profileList");
  profileList.innerHTML = "";
  for (p in profiles){
    var element =  document.createElement("div");
    element.setAttribute("class", "media");
    element.innerHTML = `<a href="profile.html?floID=${p}"><div class="media-body">
              <h5 class="media-heading">${profiles[p].name}</h5>
              <small>@${p}</small>
            </div></a>`
    profileList.appendChild(element);
  }
}

function postTweet(){
  var tweetBox = document.getElementById("tweetBox");
  var tweet = tweetBox.value;
  tweetBox.value = "";
  var time = (new Date).getTime();
  var sign = encrypt.sign(tweet,privKey);
  var data = JSON.stringify({floID:selfID,time:time,tweet:tweet,sign:sign});
  console.log(data);
  selfWebsocket.send(data);
  getLastTweetCount(selfID).then(result => {
    var SNdata = JSON.stringify({newSuperNodeTweet:true,floID:selfID,tid:result+1,data:data});
    sendDataToSuperNode(selfID,SNdata);
  }).catch(error => {
    console.log(error);
  });
}

function getFollowinglistFromIDB(){
  return new Promise((resolve,reject) => {
      var idb = indexedDB.open("FLO_Tweet");
      idb.onerror = (event) => { reject("Error in opening IndexedDB!") };
      idb.onsuccess = (event) => {
        var db = event.target.result;
        var obs = db.transaction("following", "readwrite").objectStore("following");
        var getReq = obs.getAllKeys();
        getReq.onsuccess = (event) => { resolve(event.target.result) }
        getReq.onerror = (event) => { reject('Unable to read following list!') }
        db.close();
      };
  });
}

function displayTweetsFromIDB(){
  return new Promise((resolve,reject) => {
      var idb = indexedDB.open("FLO_Tweet");
      idb.onerror = (event) => { reject("Error in opening IndexedDB!") };
      idb.onsuccess = (event) => {
        var db = event.target.result;
        var obs = db.transaction("tweets", "readwrite").objectStore("tweets");
        var curReq = obs.openCursor();
        curReq.onsuccess = (event) => {
          var cursor = event.target.result;
          if(cursor) {
            if(cursor.value.floID == selfID || following.includes(cursor.value.floID))
              createTweetElement(cursor.value.floID,cursor.value.time,cursor.value.data);
            cursor.continue();
          }else{
            resolve("Displayed Tweets from IDB!");
          }
        }
        curReq.onerror = (event) => { reject("Error in Reading tweets from IDB!") }
        db.close();
      };
  });
}

function createTweetElement(floID,time,tweet){
  var tweetDisplay = document.getElementById("tweetsContainer");
  var element =  document.createElement("div");
  element.setAttribute("class", "media");
  element.innerHTML = `
            <div class="media-body">
              <h4 class="media-heading">${profiles[floID].name} <small>@${floID}</small></h4>
              <p>${tweet.replace(/\n/g, "<br/>")}</p>
              <ul class="nav nav-pills nav-pills-custom">             
                <li><a href="#"><span class="glyphicon glyphicon-share-alt"></span></a></li>
                <li><a href="#"><span class="glyphicon glyphicon-retweet"></span></a></li>
                <li><a href="#"><span class="glyphicon glyphicon-star"></span></a></li>
                <li><a href="#"><span class="glyphicon glyphicon-option-horizontal"></span></a></li>
                <li><span class="timestamp pull-right">${getTime(time)}</span></li>
              </ul>
            </div>`;
  tweetDisplay.insertBefore(element, tweetDisplay.firstChild);
}

function connectToAllFollowing(){
  console.log("Connecting to All following servers...")
  following.forEach(floid => {
    console.log(floid)
    followingWebSockets[floid] = new WebSocket("ws://"+profiles[floid].onionAddr+"/ws");

      followingWebSockets[floid].onopen = (event) => { 
        console.log(`Connected to ${floid} Server!`);
        getLastTweetCount(floid).then(result => {
          followingWebSockets[floid].send(`>${result}`);
        }).catch(error => {
          console.log(error);
        }); 
      };
      followingWebSockets[floid].onerror = (event) => { 
        console.log(`${floid} Server is offline!`); 
        //Ping SuperNode for any new tweets 
        pingSuperNodeforNewTweets(floid);
      };
      followingWebSockets[floid].onclose = (event) => { console.log(`Disconnected from ${floid} Server!`); };
      followingWebSockets[floid].onmessage = (event) => { 
        console.log(event.data); 
        try{
          var data = JSON.parse(event.data);
          var id = data.id;
          data = data.data;
          if( floid!=data.floID || !encrypt.verify(data.tweet,data.sign,profiles[floid].pubKey))
            return
          storeTweet({floID:data.floID,time:data.time,data:data.tweet},id);
          createTweetElement(data.floID,data.time,data.tweet);
        }catch(error){
          console.log(error);
        }
      };
  });
}

function getLastTweetCount(floid){
  return new Promise((resolve,reject) => {
      var idb = indexedDB.open("FLO_Tweet");
      idb.onsuccess = (event) => {
        var db = event.target.result;
        var lastTweet = db.transaction('lastTweet', "readwrite").objectStore('lastTweet');
        var lastTweetReq = lastTweet.get(floid);
        lastTweetReq.onsuccess = (event) => {
          var result = event.target.result;
          if(result === undefined)
            result = 0;
          resolve(result);
        }
        db.close();         
      };
  });
}

function pingSuperNodeforNewMsgs(){
  var data = JSON.stringify({viaMsgreq:true,floID:selfID});
  sendDataToSuperNode(selfID,data);
}

function pingSuperNodeforNewTweets(floID){
  getLastTweetCount(floID).then(result => {
    var data = JSON.stringify({reqNewTweets:true,floID:floID,tid:result,requestor:selfID})
    sendDataToSuperNode(floID,data);
  }).catch(error => {
    console.log(error);
  }); 
}
