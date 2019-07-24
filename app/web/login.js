if( sessionStorage.profiles && sessionStorage.privKey && sessionStorage.selfID && sessionStorage.serverPass && sessionStorage.superNodeList ){
    window.location.replace("home.html");
}

const sendAmt = 0.001 ;       
const fee = 0.0005;
var username,privKey,floID;
var profiles;

function initAPIdata(){
    return new Promise((resolve,reject) => {
        console.log("initAPIdata");
        getDatafromAPI().then(result => {
            console.log(result);
            getProfilesfromIDB().then(result => {
                profiles = arrayToObject(result);
                console.log(profiles);
                sessionStorage.profiles = JSON.stringify(profiles);
                getSuperNodeListfromIDB().then(result => {
                    console.log(result)
                    superNodeList = new Set(result);
                    sessionStorage.superNodeList = JSON.stringify(Array.from(superNodeList));
                    resolve('Refresh API data Successful!')
                }).catch(error => {
                    reject(error);
                });
            }).catch(error => {
                reject(error);
            });
        }).catch(error => {
            reject(error);
        });  
    }); 
}

function customAlert(msg,type){
    color = {info:"#2196F3",danger:"#f44336",warning:"#ff9800",success:"#4CAF50"};
    var alertBox = document.createElement('div');
    alertBox.setAttribute('class','alert');
    alertBox.style.backgroundColor = color[type];
    alertBox.innerHTML = `<span class="closebtn" onclick="this.parentElement.style.display='none';">&#10006;</span> 
                            ${msg}`;
    document.getElementById("alert-container").appendChild(alertBox);
}

function disableForm(formId, disableFlag) {
    var form = document.getElementById(formId);
    for(var i=0; i<form.length; i++) 
        form[i].disabled = disableFlag;
 }

function connect(){
    document.getElementById("alert-container").innerHTML = '';
    var serverPass = document.getElementById('serverPass').value;
    initselfWebSocket(serverPass).then(result => {
        sessionStorage.serverPass = JSON.stringify(encrypt.createShamirsSecretShares(serverPass,10,10));
        customAlert(result,'success');
        disableForm('serverConnect',true);
        disableForm('userSignIn',false);
    }).catch(error => {
        customAlert(error,'danger');
    });
}

function signIn(){
    document.getElementById("alert-container").innerHTML = '';
    username = document.getElementById('username').value;
    privKey = document.getElementById('privKey').value;
    var key = new Bitcoin.ECKey(privKey);
    if(key.priv == null){
        customAlert("Invalid FLO Private Key!",'danger');
        return false;
    }
    key.setCompressed(true);
    floID = key.getBitcoinAddress();
    try{
        console.log(floID)
        if (profiles[floID] ===  undefined)
            throw `${floID} is not registers to FLO Tweet!<br/>Register FLO ID to this onion?`;
        if (profiles[floID].onionAddr != window.location.host)
            throw `${floID} is registered to another onion!<br/>Change to this onion?`;
        if (profiles[floID].name != username)
            throw `${floID} is registered to another username!<br/>Change username?`;
        login();
    }catch(msg){
        console.log(msg)
        customAlert(`${msg}<span class="closebtn" onclick="this.parentElement.parentElement.style.display='none'; signUp();">&#10004;</span>`,'warning');  
    }
}

function login(){
    sessionStorage.privKey = JSON.stringify(encrypt.createShamirsSecretShares(privKey,10,10));
    sessionStorage.selfID = floID;
    disableForm('userSignIn',true);
    customAlert(`Welcome ${username}`,'info'); 
    setTimeout(window.location.replace("home.html"), 3000);
}

function signUp(){
    registerID(floID,window.location.host,privKey,privKey.getPubKeyHex(),username).then(result =>{
        customAlert(`Registration Successful!<br/> txid : ${result}`,'success');
        refreshAPIdata().then(result => {
            console.log(result);
            login();
        }).catch(error => {
            console.log(error);
        });
    }).catch(error => {
        customAlert(error,'danger');
    });
}

function ajax(method, uri){
    var request = new XMLHttpRequest();
    var url = `${api_url}/${uri}`
    console.log(url)
    var result;
    request.open(method,url , false);
    request.onload = function () {
      if (request.readyState == 4 && request.status == 200)
        result = this.response;
      else {
        console.log('error');
        result = false;
      }
    };
    request.send();
    console.log(result);
    return result;
}

function getDatafromAPI(){
    return new Promise((resolve,reject) => {
        var addr = adminID;
        var idb = indexedDB.open("FLO_Tweet");
        idb.onerror = (event) => { reject("Error in opening IndexedDB!") };
        idb.onupgradeneeded = (event) => {
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
        idb.onsuccess = (event) => {
            var db = event.target.result;
            var lastTx = db.transaction('lastTx', "readwrite").objectStore('lastTx');
            console.log(addr);
            new Promise((res,rej) => {
                var lastTxReq = lastTx.get(addr);
                lastTxReq.onsuccess = (event) => {
                    var lasttx = event.target.result;
                    if(lasttx === undefined){
                        lasttx = 0;
                    }
                    res(lasttx);
                }
            }).then(lasttx => {
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
                    response.items.reverse().forEach(tx => {
                        try {
                            if (tx.vin[0].addr == addr){
                                var data = JSON.parse(tx.floData).FLO_Tweet_SuperNode;
                                if(data !== undefined){
                                    storeSuperNodeData(data).then(function (response) {
                                    }).catch(error => {
                                        console.log(error);
                                    });
                                }
                            }else{
                                var data = JSON.parse(tx.floData).FLO_Tweet;
                                if(data !== undefined){
                                    if(encrypt.getFLOIDfromPubkeyHex(data.pubKey)!=tx.vin[0].addr)
                                        throw("PublicKey doesnot match with floID")
                                    data = {floID : tx.vin[0].addr, onionAddr : data.onionAddr, name : data.name, pubKey:data.pubKey};
                                    storeProfile(data).then(function (response) {
                                    }).catch(error => {
                                        console.log(error);
                                    });
                                }  
                            }
                        } catch (error) {
                            //console.log(error)
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
    });
}    

function getProfilesfromIDB(){
    return new Promise((resolve,reject) => {
        var idb = indexedDB.open("FLO_Tweet");
        idb.onerror = (event) => { reject("Error in opening IndexedDB!") };
        idb.onsuccess = (event) => {
          var db = event.target.result;
          var obs = db.transaction("profiles", "readwrite").objectStore("profiles");
          var getReq = obs.getAll();
          getReq.onsuccess = (event) => { resolve(event.target.result) }
          getReq.onerror = (event) => { reject('Unable to read profiles!') }
          db.close();
        };
    });
}

function getSuperNodeListfromIDB(){
  return new Promise((resolve,reject) => {
      var idb = indexedDB.open("FLO_Tweet");
      idb.onerror = (event) => { reject("Error in opening IndexedDB!") };
      idb.onsuccess = (event) => {
        var db = event.target.result;
        var obs = db.transaction("superNodes", "readwrite").objectStore("superNodes");
        var getReq = obs.getAllKeys();
        getReq.onsuccess = (event) => { resolve(event.target.result) }
        getReq.onerror = (event) => { reject('Unable to read superNode list!') }
        db.close();
      };
  });
}

function initselfWebSocket(serverPass){
    return new Promise((resolve,reject) => {
        selfWebsocket = new WebSocket("ws://"+location.host+"/ws");
        selfWebsocket.onopen = (event) => { 
            console.log("Connecting");
            selfWebsocket.send("$"+serverPass);
        };
        selfWebsocket.onclose = (event) => { console.log("DISCONNECTED") };
        selfWebsocket.onmessage = (event) => {
            console.log(event.data); 
            if(event.data == "$Access Denied!")
                reject("Access Denied!");
            else if(event.data == "$Access Granted!")
                resolve("Access Granted!");
        };
        selfWebsocket.onerror = (event) => { console.log(event) };
    });
}

function registerID(sender,onionAddr,wif,pubkey,username) {
    return new Promise((resolve,reject) => {
        var trx = bitjs.transaction();
        var utxoAmt = 0.0;
        var x = sendAmt+fee;
        var response = ajax("GET",`api/addr/${sender}/utxo`);
        var utxos = JSON.parse(response);
        for(var x = utxos.length-1; x >= 0; x--){
            if(utxoAmt < sendAmt+fee){
                trx.addinput(utxos[x].txid, utxos[x].vout, utxos[x].scriptPubKey);
                utxoAmt += utxos[x].amount;
            }else
                break;
        }
        console.log(utxoAmt+":"+(sendAmt+fee));
        if(utxoAmt < sendAmt+fee)
            reject("Insufficient balance!");
        trx.addoutput(adminID, sendAmt);
        console.log(adminID+":"+ sendAmt);
        var change = utxoAmt-sendAmt-fee;
        if(change>0)
            trx.addoutput(sender, change);
        console.log(sender+":"+ change);
        var key = new Bitcoin.ECKey(wif);
        var sendFloData = JSON.stringify({FLO_Tweet:{onionAddr:onionAddr, name: username, pubKey: pubkey}});;
        trx.addflodata(sendFloData);
        console.log(sendFloData);
        var signedTxHash = trx.sign(wif, 1);
        console.log(signedTxHash);
        var txid = broadcastTx(signedTxHash);
        if (txid)
            resolve(txid);
        else
            reject('Registration Unsuccessful!')
    });
}

function broadcastTx(signedTxHash) {
    var http = new XMLHttpRequest();
    var url = `${api_url}/api/tx/send`;
    if (signedTxHash.length < 1) {
        return false;
    }
    
    var params = `{"rawtx":"${signedTxHash}"}`;
    var result;
    http.open('POST', url, false);

    //Send the proper header information along with the request
    http.setRequestHeader('Content-type', 'application/json');

    http.onreadystatechange = function () { //Call a function when the state changes.
        if (http.readyState == 4 && http.status == 200) {
            console.log(http.response);
            var txid = JSON.parse(http.response).txid.result;
            console.log("Transaction successful! txid : " + txid);
            result = txid;
        } else {
            console.log(http.responseText);
            result = false;
        }
    }
    http.send(params);
    return result;
}
  
