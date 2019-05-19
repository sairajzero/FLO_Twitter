
var profileWebsocket, selfWebsocket;
var profiles;
var floID, privKey, selfID, serverPass;

function viewProfile(){
  if( sessionStorage.profiles === undefined || sessionStorage.privKey === undefined || sessionStorage.selfID === undefined || sessionStorage.serverPass === undefined){
    alert("Login credentials failed! Returning to home page!");
    window.location.href = "home.html";
    return;
  }
  profiles = JSON.parse(sessionStorage.profiles);
  console.log(profiles);
  privKey = sessionStorage.privKey;
  selfID = sessionStorage.selfID;
  serverPass = sessionStorage.serverPass;
  var url = new URL(window.location.href);
  floID = url.searchParams.get("floID");
  listProfiles();
  displayProfile(floID);    
}

function displayProfile(floID){
  console.log(floID);
  var errorMsg;
  if(!floID)
    errorMsg = "Select a Profile to display";
  else if(!validateAddr(floID))
    errorMsg = "Invalid FLO ID";
  else if(!(floID in profiles))
    errorMsg = "FLO ID not registered to FLO Tweet";

  if(errorMsg !== undefined){
    document.getElementById("profileBody").innerHTML = errorMsg;
    return;
  }

  console.log("displayProfile");
  document.getElementById("profileName").innerHTML=profiles[floID].name;
  document.getElementById("profileFloID").innerHTML='@'+floID;
  initselfWebSocket();
  displayTweetFromIDB(floID).then(function(result){
    connectToX(floID).then(function(result){
      console.log(result);
      getTweetsFromX(floID);
    }).catch(function(error){
      console.log(error.message);
    });
  }).catch(function(error){
    console.log(error.message);
  }); 
}

function displayTweetFromIDB(floID){
  return new Promise(
    function(resolve,reject){
      var idb = indexedDB.open("FLO_Tweet");
      idb.onerror = function(event) {
        reject("Error in opening IndexedDB!");
      };
      idb.onsuccess = function(event) {
        var db = event.target.result;
        var obj = db.transaction("following", "readwrite").objectStore("following");
        obj.get(floID).onsuccess = function (event) {
          var followBtn = document.getElementById("follow-button");
          if(event.target.result === undefined){
            followBtn.innerHTML = "+ Follow";
            followBtn.value = "follow";
          }else{
            followBtn.innerHTML = "- Unfollow";
            followBtn.value = "unfollow";
          } 
          followBtn.disabled = false;
        }
        var obs = db.transaction("tweets", "readwrite").objectStore("tweets");
        obs.openCursor().onsuccess = function(event) {
          var cursor = event.target.result;
          if(cursor) {
            console.log(cursor.value)
            if(cursor.value.floID == floID)
              createTweetElement(floID,cursor.value.time,cursor.value.data);
            cursor.continue();
          }else{
            resolve("Displayed Tweets from IDB!");
          }
        }
        db.close();
      };
    }
  );
}

function createTweetElement(floID,time,tweet){
  var tweetDisplay = document.getElementById("profileBody");
  var element =  document.createElement("div");
  element.setAttribute("class", "media");
  element.innerHTML = `
            <div class="media-body">
              <h4 class="media-heading">${profiles[floID].name} <small>@${floID}</small></h4>
              <p>${tweet}</p>
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

function connectToX(floID){
  return new Promise(
    function(resolve,reject){
      profileWebsocket = new WebSocket("ws://"+profiles[floID].onionAddr+"/ws");
      profileWebsocket.onopen = function(ev){ 
        resolve("Connected to Profile Server!");
      };
      profileWebsocket.onerror = function(ev) { 
       reject("Profile Server is offline!"); 
      };
      profileWebsocket.onclose = function(ev) {
        console.log("Disconnected from Profile Server!")
      };
      profileWebsocket.onmessage = function(evt){ 
        console.log(evt.data); 
        try{
          var data = JSON.parse(evt.data);
          var id = data.id;
          data = data.data;
          if( floID!=data.floID || !encrypt.verify(data.tweet,data.sign,profiles[floID].pubKey))
            return
          storeTweet({floID:floID,time:data.time,data:data.tweet},id);
          createTweetElement(floID,data.time,data.tweet);
        }catch(error){
          console.log(error.message);
        }
      }
    }
  );
}

function storeTweet(data,id){
  var idb = indexedDB.open("FLO_Tweet");
  idb.onerror = function(event) {
    console.log("Error in opening IndexedDB!");
  };
  idb.onsuccess = function(event) {
    var db = event.target.result;
    var obs = db.transaction("tweets", "readwrite").objectStore("tweets");
    data.id = `${data.time}_${data.floID}`;
    obs.add(data);
    var obsL = db.transaction("lastTweet", "readwrite").objectStore("lastTweet");
    obsL.put(id,data.floID);
    db.close();
  };
}

function getTweetsFromX(floID){
  return new Promise(
    function (resolve,reject){ 
      var idb = indexedDB.open("FLO_Tweet");
      idb.onerror = function(event) {
        reject("Error in opening IndexedDB!");
      };
      idb.onsuccess = function(event) {
        var db = event.target.result;
                //window["wait"] = addrList.length;
        var lastTweet = db.transaction('lastTweet', "readwrite").objectStore('lastTweet');
               //addrList.forEach(function(addr){
        new Promise(
          function(res,rej){
            var lastTweetReq = lastTweet.get(floID);
            lastTweetReq.onsuccess = function(event){
              var result = event.target.result;
              if(result === undefined){
                 result = 0;
              }
              res(result);
            }
          }).then(function(result){
            console.log(profileWebsocket);
            profileWebsocket.send(`>${result}`);
            console.log("sent");
            resolve('Sent New tweet request to user server!');
          }).catch(function(error){
            console.log(error.message);
          });   
        db.close();         
      };
    }
  );
}

function initselfWebSocket(){
  selfWebsocket = new WebSocket("ws://"+location.host+"/ws");
  selfWebsocket.onopen = function(evt){ 
    console.log("Connecting");
    var pass = sessionStorage.serverPass;
    selfWebsocket.send("$"+pass);
  };
  selfWebsocket.onclose = function(evt){ 
    console.log("DISCONNECTED");
  };
  selfWebsocket.onmessage = function(evt){
    console.log(evt.data); 
    if(evt.data[0] == '$')
      return;
    try{
      data = JSON.parse(evt.data);
        if(data.follow && encrypt.verify(selfID, data.sign, profiles[data.floID].pubKey)){
          var idb = indexedDB.open("FLO_Tweet");
          idb.onsuccess = function(event) {
            var db = event.target.result;
            var obs = db.transaction("followers", "readwrite").objectStore("followers");
            obs.add(data.sign,data.floID);
            db.close();
          };
          selfWebsocket.send(`F${data.floID}-${data.sign}`);
        }else if(data.unfollow && encrypt.verify(selfID, data.sign, profiles[data.floID].pubKey)){
          var idb = indexedDB.open("FLO_Tweet");
          idb.onsuccess = function(event) {
            var db = event.target.result;
            var obs = db.transaction("followers", "readwrite").objectStore("followers");
            obs.delete(data.floID);
            db.close();
          };
          selfWebsocket.send(`U${data.floID}`);
        }
    }catch(error){
      console.log(error.message)
    }
  };
  selfWebsocket.onerror = function(evt){ 
    console.log(evt); 
  };
}

function follow(){
  var followBtn = document.getElementById("follow-button");
  if(followBtn.value == 'follow'){
    var sign = encrypt.sign(floID,privKey);
    var data = JSON.stringify({follow:true, floID:selfID, sign:sign});
    profileWebsocket.send(data);
    selfWebsocket.send(`f${floID}-${sign}`)
    var idb = indexedDB.open("FLO_Tweet");
    idb.onsuccess = function(event) {
      var db = event.target.result;
      var obs = db.transaction("following", "readwrite").objectStore("following");
      obs.add(sign,floID);
      db.close();
    };
    followBtn.value = 'unfollow';
    followBtn.innerHTML = "- Unfollow";
  }
  else if(followBtn.value == 'unfollow'){
    var sign = encrypt.sign(floID,privKey);
    var data = JSON.stringify({unfollow:true, floID:selfID, sign:sign});
    profileWebsocket.send(data);
    selfWebsocket.send(`u${floID}`)
    var idb = indexedDB.open("FLO_Tweet");
    idb.onsuccess = function(event) {
      var db = event.target.result;
      var obs = db.transaction("following", "readwrite").objectStore("following");
      obs.delete(floID);
      db.close();
    };
    followBtn.value = 'follow';
    followBtn.innerHTML = "+ Follow";
  }
}

