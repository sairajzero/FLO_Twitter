var profiles = []
var selfID;
var selfWebsocket,followingWebSockets = [];
var privKey;
var following;

function userDataStartUp(){
    console.log("StartUp");

    /*document.getElementById("sendMsgInput").addEventListener("keyup",function(event){
      if(event.keyCode === 13){
        event.preventDefault();
        sendMsg();
      }
    });*/

    getDatafromAPI().then(function (result) {
      console.log(result);
      getProfilesfromIDB().then(function (result){
        profiles = arrayToObject(result);
        console.log(profiles);
        sessionStorage.profiles = JSON.stringify(profiles);
        getSuperNodeListfromIDB().then(function(result){
          console.log(result)
          superNodeList = result;
          sessionStorage.superNodeList = JSON.stringify(superNodeList);
          kBucketObj.launchKBucket().then(function(result){
            console.log(result)
            getuserID().then(function(result){
              console.log(result);
              selfID = result;
              if(superNodeList.includes(selfID))
                  modSuperNode = true;
              sessionStorage.privKey = JSON.stringify(encrypt.createShamirsSecretShares(privKey,10,10));
              sessionStorage.selfID = selfID;
              alert(`${selfID}\nWelcome ${profiles[selfID].name}`)
              initselfWebSocket();
              listProfiles();
              pingSuperNodeforNewMsgs();
              getFollowinglistFromIDB().then(function(result){
                following = result;
                if(!following.includes(selfID))
                  following.push(selfID);
                console.log(following);
                displayTweetsFromIDB().then(function(result){
                  connectToAllFollowing();
                }).catch(function(error){
                  console.log(error.message);
                })
              }).catch(function(error){
                console.log(error.message);
              })
            }).catch(function (error) {
            console.log(error.message);
            });
          }).catch(function(error){
            console.log(error.message);
          }); 
        }).catch(function (error) {
          console.log(error.message);
        });
      }).catch(function (error) {
        console.log(error.message);
      });
    }).catch(function (error) {
        console.log(error.message);
    });

}

function storedata(data){
  return new Promise(
        function(resolve, reject) {
          var idb = indexedDB.open("FLO_Tweet");
          idb.onerror = function(event) {
              console.log("Error in opening IndexedDB!");
          };
          idb.onsuccess = function(event) {
              var db = event.target.result;
              var obs = db.transaction('profiles', "readwrite").objectStore('profiles');
              objectRequest = obs.put(data);
              objectRequest.onerror = function(event) {
                  reject(Error('Error occured: Unable to store data'));
                };

              objectRequest.onsuccess = function(event) {
                  resolve('Data saved OK');
              db.close();
            };
           };
        }
  );
}

function getDatafromAPI(){
    return new Promise(
          function(resolve, reject) {
            var addr = adminID;
            var idb = indexedDB.open("FLO_Tweet");
            idb.onerror = function(event) {
                reject("Error in opening IndexedDB!");
            };
            idb.onupgradeneeded = function(event) {
              var db = event.target.result;
              var objectStore0 = event.target.result.createObjectStore("superNodes");
              var objectStore1 = db.createObjectStore("profiles",{ keyPath: 'floID' });
                objectStore1.createIndex('onionAddr', 'onionAddr', { unique: false });
                objectStore1.createIndex('name', 'name', { unique: false });
                objectStore1.createIndex('pubKey', 'pubKey', { unique: false });
              var objectStore2 = db.createObjectStore("lastTx");
              var objectStore3 = db.createObjectStore("tweets",{ keyPath: 'tweetID' });
                objectStore3.createIndex('tid', 'tid', { unique: false });
                objectStore3.createIndex('floID', 'floID', { unique: false });
                objectStore3.createIndex('time', 'time', { unique: false });
                objectStore3.createIndex('data', 'data', { unique: false });
              var objectStore4 = db.createObjectStore("lastTweet");
              var objectStore5 = db.createObjectStore("followers");
              var objectStore6 = db.createObjectStore("following");
              var objectStore7 = event.target.result.createObjectStore("messages",{ keyPath: 'msgID' });
                objectStore7.createIndex('time', 'time', { unique: false });
                objectStore7.createIndex('text', 'text', { unique: false });
                objectStore7.createIndex('floID', 'floID', { unique: false });
                objectStore7.createIndex('type', 'type', { unique: false });
            };
            idb.onsuccess = function(event) {
               var db = event.target.result;
                //window["wait"] = addrList.length;
               var lastTx = db.transaction('lastTx', "readwrite").objectStore('lastTx');
               //addrList.forEach(function(addr){
                  console.log(addr);
                  new Promise(function(res,rej){
                    var lastTxReq = lastTx.get(addr);
                    lastTxReq.onsuccess = function(event){
                      var lasttx = event.target.result;
                      if(lasttx === undefined){
                          lasttx = 0;
                      }
                      res(lasttx);
                    }
                  }).then(function(lasttx){
                    var response = ajax("GET",`api/addrs/${addr}/txs`);
                      var nRequired = JSON.parse(response).totalItems - lasttx;
                      console.log(nRequired);
                      while(true && nRequired){
                        var response = ajax("GET",`api/addrs/${addr}/txs?from=0&to=${nRequired}`);
                        response = JSON.parse(response);
                        if (nRequired + lasttx != response.totalItems ){
                          nRequired = response.totalItems - lasttx;
                          continue;
                        }
                        response.items.reverse().forEach(function(tx){
                          try {
                            if (tx.vin[0].addr == addr){
                              var data = JSON.parse(tx.floData).FLO_Tweet_SuperNode;
                              if(data !== undefined){
                                storeSuperNodeData(data).then(function (response) {
                                }).catch(function (error) {
                                    console.log(error.message);
                                });
                              }
                            }else{
                              var data = JSON.parse(tx.floData).FLO_Tweet;
                              if(data !== undefined){
                                if(encrypt.getFLOIDfromPubkeyHex(data.pubKey)!=tx.vin[0].addr)
                                  throw("PublicKey doesnot match with floID")
                                data = {floID : tx.vin[0].addr, onionAddr : data.onionAddr, name : data.name, pubKey:data.pubKey};
                                storedata(data).then(function (response) {
                                }).catch(function (error) {
                                    console.log(error.message);
                                });
                              }  
                            }
                          } catch (e) {
                            //console.log(e)
                          }
                        });

                        var obs = db.transaction('lastTx', "readwrite").objectStore('lastTx');
                        obs.put(response.totalItems,addr);
                          break;
                      }
                      db.close();
                      resolve('retrived data from API');
                  });                    
                };
              }
    );
}

function storeSuperNodeData(data){
  return new Promise(
    function(resolve, reject) {
      var idb = indexedDB.open("FLO_Tweet");
      idb.onerror = function(event) {
          reject("Error in opening IndexedDB!");
      };
      idb.onsuccess = function(event) {
          var db = event.target.result;
          var obs = db.transaction('superNodes', "readwrite").objectStore('superNodes');
          if(data.addNodes)
            for(var i=0; i<data.addNodes.length; i++)
              obs.add(true,data.addNodes[i])
          if(data.removeNodes)
            for(var i=0; i<data.removeNodes.length; i++)
              obs.delete(data.removeNodes[i])
          db.close();
          resolve('Updated superNodes list in IDB');
        };
      }
   );
}

function getSuperNodeListfromIDB(){
  return new Promise(
    function(resolve,reject){
      var idb = indexedDB.open("FLO_Tweet");
      idb.onerror = function(event) {
         reject("Error in opening IndexedDB!");
      };
      idb.onsuccess = function(event) {
        var db = event.target.result;
        var obs = db.transaction("superNodes", "readwrite").objectStore("superNodes");
        var getReq = obs.getAllKeys();
        getReq.onsuccess = function(event){
          resolve(event.target.result);
        }
        getReq.onerror = function(event){
          reject('Unable to read superNode list!')
        }
        db.close();
      };
    }
  );
}

function getuserID(){
  return new Promise(
    function(resolve,reject){
      privKey = (sessionStorage.privKey !== undefined ? encrypt.retrieveShamirSecret(JSON.parse(sessionStorage.privKey)):prompt("Enter FLO Private Key : "));
      var key = new Bitcoin.ECKey(privKey);
      while(key.priv == null){
        privKey = prompt("Invalid FLO Private Key! Retry : ")
        key = Bitcoin.ECKey(privKey);
      }
      key.setCompressed(true);
      var userID = key.getBitcoinAddress();
      if (profiles[userID] ===  undefined)
        var reg = confirm(`${userID} is not registers to FLO Tweet!\nRegister FLO ID to this onion?`);
      else if (profiles[userID].onionAddr == window.location.host)
        resolve(userID)
      else
        var reg = confirm(`${userID} is registered to another onion!\nChange to this onion?`);
      
      if(reg){
        var name = prompt("Enter your name :");
        var pubKey = key.getPubKeyHex();
        if(registerID(userID,window.location.host,privKey,pubKey,name)){
          profiles[userID] = {onionAddr : window.location.host, name : name, pubKey : pubKey};
          resolve(userID);
        }       
      }
      reject(`Unable to bind ${userID} to this onionAddress!\nTry again later!`);
    }
  );
}

function getProfilesfromIDB(){
  return new Promise(
    function(resolve,reject){
      var idb = indexedDB.open("FLO_Tweet");
      idb.onerror = function(event) {
         reject("Error in opening IndexedDB!");
      };
      idb.onsuccess = function(event) {
        var db = event.target.result;
        var obs = db.transaction("profiles", "readwrite").objectStore("profiles");
        var getReq = obs.getAll();
        getReq.onsuccess = function(event){
          resolve(event.target.result);
        }
        getReq.onerror = function(event){
          reject('Unable to read profiles!')
        }
        db.close();
      };
    }
  );
}

function initselfWebSocket(){
  selfWebsocket = new WebSocket("ws://"+location.host+"/ws");
  selfWebsocket.onopen = function(evt){ 
    console.log("Connecting");
    var pass = (sessionStorage.serverPass !== undefined ? encrypt.retrieveShamirSecret(JSON.parse(sessionStorage.serverPass)): prompt("Enter server password :"));
    selfWebsocket.send("$"+pass);
    sessionStorage.serverPass = JSON.stringify(encrypt.createShamirsSecretShares(pass,5,5));
  };
  selfWebsocket.onclose = function(evt){ 
    console.log("DISCONNECTED");
  };
  selfWebsocket.onmessage = function(evt){
    console.log(evt.data); 
    if(evt.data == "$Access Denied!"){
      var pass = prompt("Access Denied! reEnter server password :");
      selfWebsocket.send("$"+pass);
      sessionStorage.serverPass = JSON.stringify(encrypt.createShamirsSecretShares(pass,5,5));
    }else if(evt.data == "$Access Granted!")
      alert("Access Granted!")
    else{
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
          selfWebsocket.send(`F${data.floID}`);
        }else if(data.unfollow && encrypt.verify(selfID, data.sign, profiles[data.floID].pubKey)){
          var idb = indexedDB.open("FLO_Tweet");
          idb.onsuccess = function(event) {
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
          if(data.reqNewTweets){
            kBucketObj.determineClosestSupernode(data.floID).then(result=>{
              if(result[0].floID == selfID)
                SuperNode_sendTweetsFromIDB(data.floID,data.tid,data.requestor);
            }).catch(e => {
              console.log(e.message);
            }); 
          }else if(data.newSuperNodeTweet){
            kBucketObj.determineClosestSupernode(data.floID).then(result=>{
              if(result[0].floID == selfID)
              SuperNode_storeSuperNodeTweet(data.data,data.tid);
            }).catch(e => {
              console.log(e.message);
            }); 
          }else if(data.viaSuperNodeMsg){
            kBucketObj.determineClosestSupernode(data.to).then(result=>{
              if(result[0].floID == selfID)
                SuperNode_storeViaSuperNodeMsg(data.from,data.to,data.data);
            }).catch(e => {
              console.log(e.message);
            }); 
          }else if(data.viaMsgreq){
            kBucketObj.determineClosestSupernode(data.floID).then(result=>{
              if(result[0].floID == selfID)
              SuperNode_sendviaMsgFromIDB(data.floID);
            }).catch(e => {
              console.log(e.message);
            }); 
          }
        }
      }catch(error){
        console.log(error.message);
      }
    }
  };
  selfWebsocket.onerror = function(evt){ 
    console.log(evt); 
  };
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
  //document.getElementById("profileInfo").style.display = "none";
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
  getLastTweetCount(selfID).then(function(result){
    sendTweetToSuperNode(data,result+1);
  }).catch(function(error){
    console.log(error.message);
  });
}

function storeTweet(data,tid){
  var idb = indexedDB.open("FLO_Tweet");
  idb.onerror = function(event) {
    console.log("Error in opening IndexedDB!");
  };
  idb.onsuccess = function(event) {
    var db = event.target.result;
    var obs = db.transaction("tweets", "readwrite").objectStore("tweets");
    data.tweetID = `${data.time}_${data.floID}`;
    data.tid = tid;
    obs.add(data);
    var obsL = db.transaction("lastTweet", "readwrite").objectStore("lastTweet");
    obsL.put(tid,data.floID);
    db.close();
  };
}

function storeMsg(data){
  var idb = indexedDB.open("FLO_Tweet");
  idb.onerror = function(event) {
    console.log("Error in opening IndexedDB!");
  };
  idb.onsuccess = function(event) {
    var db = event.target.result;
    var obs = db.transaction("messages", "readwrite").objectStore("messages");
    data.msgID = `${data.time}_${data.floID}`;
    obs.add(data);
    db.close();
  };
}

function sendTweetToSuperNode(data,tid){
  kBucketObj.determineClosestSupernode(selfID).then(result=>{
    var superNodeWS = new WebSocket("ws://"+profiles[result[0].floID].onionAddr+"/ws");
    superNodeWS.onopen = function(ev){ 
      console.log(`Connected to self SuperNode!`);
      data = JSON.stringify({newSuperNodeTweet:true,floID:selfID,tid:tid,data:data})
      console.log(data)
      superNodeWS.send(data);
    };
    superNodeWS.onerror = function(ev) {console.log(`self SuperNode is offline!`);};
    superNodeWS.onclose = function(ev) {console.log(`Disconnected from self SuperNode!`);};
  }).catch(e => {
    console.log(e.message);
  }); 
}

function getFollowinglistFromIDB(){
  return new Promise(
    function(resolve,reject){
      var idb = indexedDB.open("FLO_Tweet");
      idb.onerror = function(event) {
         reject("Error in opening IndexedDB!");
      };
      idb.onsuccess = function(event) {
        var db = event.target.result;
        var obs = db.transaction("following", "readwrite").objectStore("following");
        var getReq = obs.getAllKeys();
        getReq.onsuccess = function(event){
          resolve(event.target.result);
        }
        getReq.onerror = function(event){
          reject('Unable to read following list!')
        }
        db.close();
      };
    }
  );
}

function displayTweetsFromIDB(){
  return new Promise(
    function(resolve,reject){
      var idb = indexedDB.open("FLO_Tweet");
      idb.onerror = function(event) {
         reject("Error in opening IndexedDB!");
      };
      idb.onsuccess = function(event) {
        var db = event.target.result;
        var obs = db.transaction("tweets", "readwrite").objectStore("tweets");
        var curReq = obs.openCursor();
        curReq.onsuccess = function(event) {
          var cursor = event.target.result;
          if(cursor) {
            //console.log(cursor.value)
            if(cursor.value.floID == selfID || following.includes(cursor.value.floID))
              createTweetElement(cursor.value.floID,cursor.value.time,cursor.value.data);
            cursor.continue();
          }else{
            resolve("Displayed Tweets from IDB!");
          }
        }
        curReq.onerror = function(event){
          reject("Error in Reading tweets from IDB!");
        }
        db.close();
      };
    }
  );
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

      followingWebSockets[floid].onopen = function(ev){ 
        console.log(`Connected to ${floid} Server!`);
        getLastTweetCount(floid).then(function(result){
          followingWebSockets[floid].send(`>${result}`);
        }).catch(function(error){
          console.log(error.message);
        }); 
      };
      followingWebSockets[floid].onerror = function(ev) { 
        console.log(`${floid} Server is offline!`); 
        //Ping SuperNode for any new tweets 
        pingSuperNodeforNewTweets(floid);
        
      };
      followingWebSockets[floid].onclose = function(ev) {
        console.log(`Disconnected from ${floid} Server!`);
      };
      followingWebSockets[floid].onmessage = function(evt){ 
        console.log(evt.data); 
        try{
          var data = JSON.parse(evt.data);
          var id = data.id;
          data = data.data;
          if( floid!=data.floID || !encrypt.verify(data.tweet,data.sign,profiles[floid].pubKey))
            return
          storeTweet({floID:data.floID,time:data.time,data:data.tweet},id);
          createTweetElement(data.floID,data.time,data.tweet);
        }catch(error){
          console.log(error.message);
        }
      };
  });
}

function getLastTweetCount(floid){
  return new Promise(
    function(resolve,reject){
      var idb = indexedDB.open("FLO_Tweet");
      idb.onsuccess = function(event) {
        var db = event.target.result;
        var lastTweet = db.transaction('lastTweet', "readwrite").objectStore('lastTweet');
        var lastTweetReq = lastTweet.get(floid);
        lastTweetReq.onsuccess = function(event){
          var result = event.target.result;
          if(result === undefined)
            result = 0;
          resolve(result);
        }
        db.close();         
      };
    }
  );
}

function pingSuperNodeforNewMsgs(){
  var data = JSON.stringify({viaMsgreq:true,floID:selfID});
  sendDataToSuperNode(selfID,data);
}

function pingSuperNodeforNewTweets(floID){
  getLastTweetCount(floID).then(function(result){
    var data = JSON.stringify({reqNewTweets:true,floID:floID,tid:result,requestor:selfID})
    sendDataToSuperNode(floID,data);
  }).catch(function(error){
    console.log(error.message);
  }); 
}

function SuperNode_storeSuperNodeTweet(data,tid){
  var idb = indexedDB.open("FLO_Tweet",2);
  idb.onerror = function(event) {
    console.log("Error in opening IndexedDB!");
  };
  idb.onupgradeneeded = function(event){
    var objectStore1 = event.target.result.createObjectStore("superNodeTweet",{ keyPath: 'tweetID' });
    objectStore1.createIndex('floID', 'floID', { unique: false });
    objectStore1.createIndex('tid', 'tid', { unique: false });
    objectStore1.createIndex('data', 'data', { unique: false });
    var objectStore2 = event.target.result.createObjectStore("viaSuperNodeMsg",{ keyPath: 'id',autoIncrement:true });
    objectStore2.createIndex('from', 'from', { unique: false });
    objectStore2.createIndex('to', 'to', { unique: false });
    objectStore2.createIndex('data', 'data', { unique: false });
  }
  idb.onsuccess = function(event) {
    var db = event.target.result;
    var obs = db.transaction("superNodeTweet", "readwrite").objectStore("superNodeTweet");
    var parsedData = JSON.parse(data);
    var tweetID = ''+parsedData.floID+'_'+parsedData.time; 
    obs.add({tweetID:tweetID,floID:parsedData.floID,tid:tid,data:data});
    db.close();
  };
}

function SuperNode_storeViaSuperNodeMsg(from,to,data){
  var idb = indexedDB.open("FLO_Tweet",2);
  idb.onerror = function(event) {
    console.log("Error in opening IndexedDB!");
  };
  idb.onupgradeneeded = function(event){
    var objectStore1 = event.target.result.createObjectStore("superNodeTweet",{ keyPath: 'tweetID' });
    objectStore1.createIndex('floID', 'floID', { unique: false });
    objectStore1.createIndex('tid', 'tid', { unique: false });
    objectStore1.createIndex('data', 'data', { unique: false });
    var objectStore2 = event.target.result.createObjectStore("viaSuperNodeMsg",{ keyPath: 'id',autoIncrement :true });
    objectStore2.createIndex('from', 'from', { unique: false });
    objectStore2.createIndex('to', 'to', { unique: false });
    objectStore2.createIndex('data', 'data', { unique: false });
  }
  idb.onsuccess = function(event) {
    var db = event.target.result;
    var obs = db.transaction("viaSuperNodeMsg", "readwrite").objectStore("viaSuperNodeMsg");
    obs.add({from:from,to:to,data:data});
    db.close();
  };
}

function SuperNode_sendTweetsFromIDB(floID,tid,requestor){
  return new Promise(
    function(resolve,reject){
      var requestorWS = new WebSocket("ws://"+profiles[requestor].onionAddr+"/ws");

      requestorWS.onopen = function(ev){ 
        console.log(`sending ${floID} tweets to ${requestor} Server!`);
        var idb = indexedDB.open("FLO_Tweet",2);
        idb.onerror = function(event) {
          reject("Error in opening IndexedDB!");
        };
        idb.onupgradeneeded = function(event){
          var objectStore1 = event.target.result.createObjectStore("superNodeTweet",{ keyPath: 'tweetID' });
          objectStore1.createIndex('floID', 'floID', { unique: false });
          objectStore1.createIndex('tid', 'tid', { unique: false });
          objectStore1.createIndex('data', 'data', { unique: false });
          var objectStore2 = event.target.result.createObjectStore("viaSuperNodeMsg",{ keyPath: 'id',autoIncrement:true });
          objectStore2.createIndex('from', 'from', { unique: false });
          objectStore2.createIndex('to', 'to', { unique: false });
          objectStore2.createIndex('data', 'data', { unique: false });
        }
        idb.onsuccess = function(event) {
          var db = event.target.result;
          var obs = db.transaction("superNodeTweet", "readwrite").objectStore("superNodeTweet");
          var curReq = obs.openCursor();
          curReq.onsuccess = function(event) {
            var cursor = event.target.result;
            if(cursor) {
              if(cursor.value.floID == floID && cursor.value.tid > tid){
                data = JSON.stringify({fromSuperNode:true, floID:cursor.value.floID,tid:cursor.value.tid,data:cursor.value.data})
                requestorWS.send(data);
              }
              cursor.continue();
            }else{
              resolve("Displayed Tweets from IDB!");
            }
          }
          curReq.onerror = function(event){
            reject("Error in Reading tweets from IDB!");
          }
          db.close();
        };
      };
      requestorWS.onerror = function(ev) { 
        console.log(`${requestor} Server is offline!`); 
      };
      requestorWS.onclose = function(ev) {
        console.log(`Disconnected from ${requestor} Server!`);
      };
    }
  );
}        

function SuperNode_sendviaMsgFromIDB(floID){
  var receiverWS = new WebSocket("ws://"+profiles[floID].onionAddr+"/ws");
  receiverWS.onopen = function(ev){ 
    var idb = indexedDB.open("FLO_Tweet",2);
    idb.onerror = function(event) {
      console.log("Error in opening IndexedDB!");
    };
    idb.onupgradeneeded = function(event) {
      var objectStore1 = event.target.result.createObjectStore("superNodeTweet",{ keyPath: 'tweetID' });
      objectStore1.createIndex('floID', 'floID', { unique: false });
      objectStore1.createIndex('tid', 'tid', { unique: false });
      objectStore1.createIndex('data', 'data', { unique: false });
      var objectStore2 = event.target.result.createObjectStore("viaSuperNodeMsg",{ keyPath: 'id',autoIncrement:true });
      objectStore2.createIndex('from', 'from', { unique: false });
      objectStore2.createIndex('to', 'to', { unique: false });
      objectStore2.createIndex('data', 'data', { unique: false });
    };
    idb.onsuccess = function(event) {
      var db = event.target.result;
      var obs = db.transaction("viaSuperNodeMsg", "readwrite").objectStore("viaSuperNodeMsg");
      obs.openCursor().onsuccess = function(event) {
        var cursor = event.target.result;
        if(cursor) {
          if(cursor.value.to == floID){
            receiverWS.send(cursor.value.data);
            cursor.delete();
          }
          cursor.continue();
        }else{
          console.log('Sent All messages to '+floID)
        }
      }
      db.close();
    };
  };
  receiverWS.onerror = function(ev) { console.log('Connection Error to '+floID) };
  receiverWS.onclose = function(ev) { console.log('Disconnected from '+floID) };
}