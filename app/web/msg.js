var profiles;
var receiverID,selfID,privKey,modSuperNode;
var selfwebsocket,receiverWebSocket,recStat;

function initMsgs(){
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
    console.log(result)
    initselfWebSocket();
    readMsgfromIDB().then(result => {
      listProfiles();
      document.getElementById("sendMsgInput").addEventListener("keyup",(event) => {
        if(event.keyCode === 13){
          event.preventDefault();
          sendMsg();
        }
      });
    }).catch(error => {
      console.log(error);
    });
  }).catch(error => {
    console.log(error);
  });
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
    element.innerHTML = `<a href="javascript:changeReceiver('${p}');"><div class="media-body">
                          <h5 class="media-heading">${profiles[p].name}</h5>
                          <small>@${p}</small>
                        </div></a>`
    profileList.appendChild(element);
  }
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
          selfWebsocket.send(`F${data.floID}-${data.sign}`);
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
          if(encrypt.verify(msg,data.sign,profiles[data.from].pubKey)){
            createMsgElement(data.from,data.time,msg,'R')
            storeMsg({time:data.time,floID:data.from,text:msg,type:'R'});
          }
        }else if(modSuperNode){
          superNodeMode(data);
        }
    }catch(error){
      console.log(error)
    }
  };
  selfWebsocket.onerror = (event) => { console.log(event) };
}

function readMsgfromIDB(){
  return new Promise((resolve,reject) => {
      var disp = document.getElementById("msgsContainer");
      for(floID in profiles){
        var element = document.createElement('div');
        element.setAttribute("id", floID);
        element.style.display = 'none';
        disp.appendChild(element);
      }
      var idb = indexedDB.open("FLO_Tweet");
      idb.onerror = (event) => { reject("Error in opening IndexedDB!") };
      idb.onsuccess = (event) => {
        var db = event.target.result;
        var obs = db.transaction("messages", "readwrite").objectStore("messages");
        obs.openCursor().onsuccess = (event) => {
          var cursor = event.target.result;
          if(cursor) {
            createMsgElement(cursor.value.floID,cursor.value.time,cursor.value.text,cursor.value.type);
            cursor.continue();
          } else {
            console.log('Entries all displayed.');
            resolve("Read Msg from IDB");
          }
        };
        db.close();
      };
  });
}

function changeReceiver(floID){
  try{
    if(receiverID !== undefined)
      document.getElementById(receiverID).style.display = 'none';
    if(receiverWebSocket !== undefined && receiverWebSocket.readyState === WebSocket.OPEN)
      receiverWebSocket.close();
  }catch(e){
    console.log(e);
  }
  console.log(floID);
  receiverID = floID;
  document.getElementById('recipient_floID').innerHTML = `${profiles[receiverID].name}<br><small>@${receiverID}<small>`;
  recStat = false;
  document.getElementById(receiverID).style.display = 'block';
  try{
    receiverWebSocket = new WebSocket("ws://"+profiles[receiverID].onionAddr+"/ws");
    receiverWebSocket.onopen = (event) => { recStat = true; };
    receiverWebSocket.onerror = (event) => { recStat = false;};
    receiverWebSocket.onclose = (event) => { recStat = false; };
  }catch(e){
    console.log(e);
  }
}

function sendMsg(){
  if(receiverID === undefined){
    alert("Select a contact and send message");
    return;
  }
  var inp = document.getElementById('sendMsgInput');
  var msg = inp.value;
  inp.value = "";
  console.log(msg);
  var time = Date.now();
  var sign = encrypt.sign(msg,privKey);
  var msgEncrypt = encrypt.encryptMessage(msg,profiles[receiverID].pubKey);
  var data = JSON.stringify({message:true,from:selfID,to:receiverID,time:time,secret:msgEncrypt.secret,sign:sign,pubVal:msgEncrypt.senderPublicKeyString});
  if(recStat)
    receiverWebSocket.send(data);
  else{
    var SNdata = JSON.stringify({viaSuperNodeMsg:true,from:selfID,to:receiverID,data:data});
    sendDataToSuperNode(receiverID,SNdata);
  }
  console.log(`sentMsg : ${data}`);
  createMsgElement(receiverID,time,msg,'S');
  storeMsg({time:time,floID:receiverID,text:msg,type:'S'});
}

function createMsgElement(floID,time,msg,type){
  var msgField = document.getElementById(floID);
  var element =  document.createElement("div");
  element.setAttribute("class", "media");
  element.innerHTML = `
            <div class="media-body">
              <div class="msg-${type}">
                <span class="message-text">${msg}</span><br/>
                <small class="timestamp pull-right">${getTime(time)}</small>
              </div>
            </div>`;
  msgField.appendChild(element);
}
