var profiles = []
var receiverID,tweeterID,recStat;
var selfWebsocket,receiverWebSocket;
var privKey;

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
      getDatafromIDB().then(function (result){
        profiles = arrayToObject(result);
        console.log(profiles);
        sessionStorage.profiles = JSON.stringify(profiles);
        getuserID().then(function(result){
          console.log(result);
          tweeterID = result;
          sessionStorage.privKey = privKey;
          sessionStorage.selfID = tweeterID;
          alert(`${tweeterID}\nWelcome ${profiles[tweeterID].name}`)
          //readMsgfromIDB().then(function(result){
            //console.log(result);
            initselfWebSocket();
            listProfiles();
            //displayprofiles();
            //const createClock = setInterval(checkStatusInterval, 30000);
          //}).catch(function(error){
            //console.log(error.message);
          //});
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
            var addr = "F6LUnwRRjFuEW97Y4av31eLqqVMK9FrgE2";
            var idb = indexedDB.open("FLO_Tweet");
            idb.onerror = function(event) {
                reject("Error in opening IndexedDB!");
            };
            idb.onupgradeneeded = function(event) {
              var db = event.target.result;
              var objectStore1 = db.createObjectStore("profiles",{ keyPath: 'floID' });
                objectStore1.createIndex('onionAddr', 'onionAddr', { unique: false });
                objectStore1.createIndex('name', 'name', { unique: false });
                objectStore1.createIndex('pubKey', 'pubKey', { unique: false });
              var objectStore2 = db.createObjectStore("lastTx");
              var objectStore3 = db.createObjectStore("tweets",{ keyPath: 'id' });
                objectStore3.createIndex('floID', 'floID', { unique: false });
                objectStore3.createIndex('time', 'time', { unique: false });
                objectStore3.createIndex('data', 'data', { unique: false });
              var objectStore4 = db.createObjectStore("lastTweet");
              var objectStore5 = db.createObjectStore("followers");
              var objectStore6 = db.createObjectStore("following");
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
                            //if (tx.vin[0].addr != addr)
                              //return;
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


function getuserID(){
  return new Promise(
    function(resolve,reject){
      privKey = sessionStorage.privKey || prompt("Enter FLO Private Key : ");
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

function getDatafromIDB(){
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

function readMsgfromIDB(){
  return new Promise(
    function(resolve,reject){
      var disp = document.getElementById("conversation");
      for(floID in profiles){
        var createLi = document.createElement('div');
        createLi.setAttribute("id", floID);
        createLi.setAttribute("class", "message-inner");
        createLi.style.display = 'none';
        disp.appendChild(createLi);
      }
      var idb = indexedDB.open("FLO_Tweet",2);
      idb.onerror = function(event) {
        reject("Error in opening IndexedDB!");
      };
      idb.onupgradeneeded = function(event) {
        var objectStore = event.target.result.createObjectStore("messages",{ keyPath: 'time' });
        objectStore.createIndex('text', 'text', { unique: false });
        objectStore.createIndex('floID', 'floID', { unique: false });
        objectStore.createIndex('type', 'type', { unique: false });
      };
      idb.onsuccess = function(event) {
        var db = event.target.result;
        var obs = db.transaction("messages", "readwrite").objectStore("messages");
        obs.openCursor().onsuccess = function(event) {
          var cursor = event.target.result;
          if(cursor) {
            var chat = document.getElementById(cursor.value.floID);
            if(cursor.value.type == "R"){
              var msgdiv = document.createElement('div');
              msgdiv.setAttribute("class", "row message-body");
              msgdiv.innerHTML = `<div class="col-sm-12 message-main-receiver">
                      <div class="receiver">
                        <span class="message-text">
                         ${cursor.value.text}
                        </span>
                        <span class="message-time pull-right">
                          ${getTime(cursor.value.time)}
                        </span>
                      </div>
                    </div>`;
              chat.appendChild(msgdiv);
            }else if(cursor.value.type == "S"){
              var msgdiv = document.createElement('div');
              msgdiv.setAttribute("class", "row message-body");
              msgdiv.innerHTML = `<div class="col-sm-12 message-main-sender">
                      <div class="sender">
                        <span class="message-text">${cursor.value.text}
                        </span>
                        <span class="message-time pull-right">
                          ${getTime(cursor.value.time)}
                        </span>
                      </div>
                    </div>`;
              chat.appendChild(msgdiv);
            }

            cursor.continue();
          } else {
            console.log('Entries all displayed.');
            resolve("Read Msg from IDB");
          }
        };
        db.close();
      };
    }
  );
}

function storeMsg(data){
  var idb = indexedDB.open("FLO_Tweet",2);
  idb.onerror = function(event) {
    console.log("Error in opening IndexedDB!");
  };
  idb.onupgradeneeded = function(event) {
    var objectStore = event.target.result.createObjectStore("messages",{ keyPath: 'time' });
    objectStore.createIndex('text', 'text', { unique: false });
    objectStore.createIndex('floID', 'floID', { unique: false });
    objectStore.createIndex('type', 'type', { unique: false });
  };
  idb.onsuccess = function(event) {
    var db = event.target.result;
    var obs = db.transaction("messages", "readwrite").objectStore("messages");
    obs.add(data);
    db.close();
  };
}

function displayProfiles(){
  console.log('displayProfiles');
  var listElement = document.getElementById('contact-display');
  for(floID in profiles){
    var createLi = document.createElement('div');
    createLi.setAttribute("name", floID);
    createLi.setAttribute("onClick", 'changeReceiver(this)');
    createLi.setAttribute("class", "row sideBar-body");
    createLi.innerHTML = `<div class="col-sm-11 col-xs-11 sideBar-main">
                <div class="row">
                  <div class="col-sm-8 col-xs-8 sideBar-name">
                    <span class="name-meta">${floID}
                  </span>
                  </div>
                  <div class="col-sm-4 col-xs-4 pull-right sideBar-time">
                    <span class="time-meta pull-right">${profiles[floID].name}
                  </span>
                  </div>
                </div>
              </div>`
    listElement.appendChild(createLi);
  }
}

function initselfWebSocket(){
  selfWebsocket = new WebSocket("ws://"+location.host+"/ws");
  selfWebsocket.onopen = function(evt){ 
    console.log("Connecting");
    var pass = sessionStorage.serverPass || prompt("Enter server password :");
    selfWebsocket.send("$"+pass);
    sessionStorage.serverPass = pass;
  };
  selfWebsocket.onclose = function(evt){ 
    console.log("DISCONNECTED");
  };
  selfWebsocket.onmessage = function(evt){
    console.log(evt.data); 
    if(evt.data == "$Access Denied!"){
      var pass = prompt("Access Denied! reEnter server password :");
      selfWebsocket.send("$"+pass);
      sessionStorage.serverPass = pass;
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


function checkStatusInterval(){
  try{
    if(receiverWebSocket !== undefined && receiverWebSocket.readyState !== WebSocket.OPEN){
      receiverWebSocket.close()
      receiverWebSocket = new WebSocket("ws://"+profiles[receiverID].onionAddr+"/ws");
      receiverWebSocket.onopen = function(evt){ receiverWebSocket.send('#') };
      receiverWebSocket.onerror = function(ev) { receiverStatus(false); };
      receiverWebSocket.onclose = function(ev) { receiverStatus(false); };
      receiverWebSocket.onmessage = function(evt){ 
      console.log(evt.data); 
      if(evt.data[0]=='#'){
        if (evt.data[1]=='+')
          receiverStatus(true);
        else if(evt.data[1]=='-')
          receiverStatus(false);
      }
    }
    }    
  }catch(e){
    console.log(e);
  }
}

function postTweet(){
  var tweetBox = document.getElementById("tweetBox");
  var tweet = tweetBox.value;
  tweetBox.value = "";
  var time = (new Date).getTime();
  var sign = encrypt.sign(tweet,privKey);
  var data = JSON.stringify({floID:tweeterID,time:time,tweet:tweet,sign:sign});
  console.log(data);
  selfWebsocket.send(data);
}










function changeReceiver(param){
  if(receiverID !== undefined)
    document.getElementById(receiverID).style.display = 'none';
  console.log(param.getAttribute("name"));
  receiverID = param.getAttribute("name");
  document.getElementById('recipient-floID').innerHTML = receiverID;
  receiverStatus(false)
  document.getElementById(receiverID).style.display = 'block';
  try{
    if(receiverWebSocket !== undefined && receiverWebSocket.readyState === WebSocket.OPEN)
      receiverWebSocket.close()
    receiverWebSocket = new WebSocket("ws://"+profiles[receiverID].onionAddr+"/ws");
    receiverWebSocket.onopen = function(ev){ receiverWebSocket.send('#'); };
    receiverWebSocket.onerror = function(ev) { receiverStatus(false); };
    receiverWebSocket.onclose = function(ev) { receiverStatus(false); };
    receiverWebSocket.onmessage = function(evt){ 
      console.log(evt.data); 
      if(evt.data[0]=='#'){
        if (evt.data[1]=='+')
          receiverStatus(true);
        else if(evt.data[1]=='-')
          receiverStatus(false);
      }
    }
  }catch(e){
    console.log(e);
  }
}

function receiverStatus(status){
  if(status)
    document.getElementById('recipient-status').style.color = "#4CC94C";
  else
    document.getElementById('recipient-status').style.color = "#CD5C5C";
  recStat = status;
}



function sendMsg(){
  if(receiverID === undefined){
    alert("Select a contact and send message");
    return;
  }
  if(!recStat){
    alert("Recipient is offline! Try again later")
    return
  }
  var inp = document.getElementById('sendMsgInput')
  var msg = inp.value;
  inp.value = "";
  console.log(msg);
  var sign = encrypt.sign(msg,privKey)
  var msgEncrypt = encrypt.encryptMessage(msg,contacts[receiverID].pubKey)
  var data = JSON.stringify({from:senderID,secret:msgEncrypt.secret,sign:sign,pubVal:msgEncrypt.senderPublicKeyString});
  receiverWebSocket.send(data);
  console.log(`sentMsg : ${data}`);
      time = Date.now();
      var disp = document.getElementById(receiverID);
      var msgdiv = document.createElement('div');
      msgdiv.setAttribute("class", "row message-body");
      msgdiv.innerHTML = `<div class="col-sm-12 message-main-sender">
              <div class="sender">
                <span class="message-text">${msg}
                </span>
                <span class="message-time pull-right">
                  ${getTime(time)}
                </span>
              </div>
            </div>`;
      disp.appendChild(msgdiv);
      storeMsg({time:time,floID:receiverID,text:msg,type:"S"});
}