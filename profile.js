
var profileWebsocket;
var profiles;

function viewProfile(){
  if(sessionStorage.profiles)
    profiles = JSON.parse(sessionStorage.profiles)
  else{
    alert("Profiles not loaded! redirecting to home!");
    window.location.href = "home.html";
  }
  console.log(profiles);
  var url = new URL(window.location.href);
  var floID = url.searchParams.get("floID");
  if(floID)
    displayProfile(floID);
  else
    listProfiles();
}

function listProfiles(){
  console.log("listProfiles");
  var profileBody =  document.getElementById("profileBody");
  profileBody.innerHTML = "";
  for (p in profiles){
    var element =  document.createElement("div");
    element.setAttribute("class", "media");
    element.innerHTML = `<a href="profile.html?floID=${p}"><div class="media-body">
              <h4 class="media-heading">${profiles[p].name}</h4>
              @${p}
            </div></a>
            <hr/>`
    profileBody.appendChild(element);
  }
  document.getElementById("profileInfo").style.display = "none";
}

function displayProfile(floID){
  if(!validateAddr(floID)){
    alert("Invalid FLO ID");
    listProfiles();
    return;
  }
  if(!(floID in profiles)){
    alert("FLO ID not registered to FLO Tweet");
    listProfiles();
    return;
  }
  console.log("displayProfile");
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
      var idb = indexedDB.open("FLO_Tweet",2);
      idb.onerror = function(event) {
        reject("Error in opening IndexedDB!");
      };
      idb.onupgradeneeded = function(event) {
        var objectStore = event.target.result.createObjectStore("tweets",{ keyPath: 'id' });
        objectStore.createIndex('floID', 'floID', { unique: false });
        objectStore.createIndex('time', 'time', { unique: false });
        objectStore.createIndex('data', 'data', { unique: false });
        var objectStore2 = event.target.result.createObjectStore("lastTweet");
      };
      idb.onsuccess = function(event) {
        var db = event.target.result;
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
  var idb = indexedDB.open("FLO_Tweet",2);
  idb.onerror = function(event) {
    console.log("Error in opening IndexedDB!");
  };
  idb.onupgradeneeded = function(event) {
    var objectStore = event.target.result.createObjectStore("tweets",{ keyPath: 'id' });
    objectStore.createIndex('floID', 'floID', { unique: false });
    objectStore.createIndex('time', 'time', { unique: false });
    objectStore.createIndex('data', 'data', { unique: false });
    var objectStore2 = event.target.result.createObjectStore("lastTweet");
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
      var idb = indexedDB.open("FLO_Tweet",2);
      idb.onerror = function(event) {
        reject("Error in opening IndexedDB!");
      };
      idb.onupgradeneeded = function(event) {
        var objectStore = event.target.result.createObjectStore("tweets",{ keyPath: 'id' });
        objectStore.createIndex('floID', 'floID', { unique: false });
        objectStore.createIndex('time', 'time', { unique: false });
        objectStore.createIndex('data', 'data', { unique: false });
        var objectStore2 = event.target.result.createObjectStore("lastTweet");
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
