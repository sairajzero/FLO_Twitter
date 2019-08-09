
window.indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
window.IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction || window.msIDBTransaction;
window.IDBKeyRange = window.IDBKeyRange || window.webkitIDBKeyRange || window.msIDBKeyRange;
   
if (!window.indexedDB) {
     window.alert("Your browser doesn't support a stable version of IndexedDB.")
}

const adminID = "FMabh7gTSyKPAb2Wi9sK5CBhV8nVFk783i"; 

if(blockchain == "FLO")
  var api_url = `https://flosight.duckdns.org/`;
else if(blockchain == "FLO_TEST")
  var api_url = `https://testnet-flosight.duckdns.org/`;

var supernodeKBucket;
var superNodeList;
var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

var encrypt = {

            p: BigInteger("FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F", 16),

            exponent1: function () {
                return this.p.add(BigInteger.ONE).divide(BigInteger("4"))
            },

            calculateY: function (x) {
                let p = this.p;
                let exp = this.exponent1();
                // x is x value of public key in BigInteger format without 02 or 03 or 04 prefix
                return x.modPow(BigInteger("3"), p).add(BigInteger("7")).mod(p).modPow(exp, p)
            },

            // Insert a compressed public key
            getUncompressedPublicKey: function (compressedPublicKey) {

                const p = this.p;

                // Fetch x from compressedPublicKey
                let pubKeyBytes = Crypto.util.hexToBytes(compressedPublicKey);
                const prefix = pubKeyBytes.shift() // remove prefix
                let prefix_modulus = prefix % 2;
                pubKeyBytes.unshift(0) // add prefix 0
                let x = new BigInteger(pubKeyBytes)
                let xDecimalValue = x.toString()

                // Fetch y
                let y = this.calculateY(x);
                let yDecimalValue = y.toString();

                // verify y value
                let resultBigInt = y.mod(BigInteger("2"));

                let check = resultBigInt.toString() % 2;

                if (prefix_modulus !== check) {
                    yDecimalValue = y.negate().mod(p).toString();
                }

                return {
                    x: xDecimalValue,
                    y: yDecimalValue
                };
            },

            getSenderPublicKeyString: function () {
                privateKey = ellipticCurveEncryption.senderRandom();
                senderPublicKeyString = ellipticCurveEncryption.senderPublicString(privateKey);
                return {
                    privateKey: privateKey,
                    senderPublicKeyString: senderPublicKeyString
                }
            },

            deriveSharedKeySender: function (receiverCompressedPublicKey, senderPrivateKey) {
                try {
                    let receiverPublicKeyString = this.getUncompressedPublicKey(
                        receiverCompressedPublicKey);
                    var senderDerivedKey = {
                        XValue: "",
                        YValue: ""
                    };
                    senderDerivedKey = ellipticCurveEncryption.senderSharedKeyDerivation(
                        receiverPublicKeyString.x,
                        receiverPublicKeyString.y, senderPrivateKey);
                    return senderDerivedKey;
                } catch (error) {
                    return new Error(error);
                }
            },

            deriveReceiverSharedKey: function (senderPublicKeyString, receiverPrivateKey) {
                return ellipticCurveEncryption.receiverSharedKeyDerivation(
                    senderPublicKeyString.XValuePublicString, senderPublicKeyString.YValuePublicString,
                    receiverPrivateKey);
            },

            getReceiverPublicKeyString: function (privateKey) {
                return ellipticCurveEncryption.receiverPublicString(privateKey);
            },

            deriveSharedKeyReceiver: function (senderPublicKeyString, receiverPrivateKey) {
                try {
                    return ellipticCurveEncryption.receiverSharedKeyDerivation(senderPublicKeyString.XValuePublicString,
                        senderPublicKeyString.YValuePublicString, receiverPrivateKey);

                } catch (error) {
                    return new Error(error);
                }
            },

            encryptMessage: function (data, receiverCompressedPublicKey) {
                var senderECKeyData = this.getSenderPublicKeyString();
                var senderDerivedKey = {
                    XValue: "",
                    YValue: ""
                };
                var senderPublicKeyString = {};
                senderDerivedKey = this.deriveSharedKeySender(
                    receiverCompressedPublicKey, senderECKeyData.privateKey);
                //console.log("senderDerivedKey", senderDerivedKey);
                let senderKey = senderDerivedKey.XValue + senderDerivedKey.YValue;
                let secret = Crypto.AES.encrypt(data, senderKey);
                return {
                    secret: secret,
                    senderPublicKeyString: senderECKeyData.senderPublicKeyString
                };
            },

            decryptMessage: function (secret, senderPublicKeyString) {
                var receiverDerivedKey = {
                    XValue: "",
                    YValue: ""
                };
                var receiverECKeyData = {};
                var myPrivateKey = privKey;
                if (typeof myPrivateKey !== "string") throw new Error("No private key found.");

                let privateKey = this.wifToDecimal(myPrivateKey, true);
                if (typeof privateKey.privateKeyDecimal !== "string") throw new Error(
                    "Failed to detremine your private key.");
                receiverECKeyData.privateKey = privateKey.privateKeyDecimal;

                receiverDerivedKey = this.deriveReceiverSharedKey(senderPublicKeyString,
                    receiverECKeyData.privateKey);
                //console.log("receiverDerivedKey", receiverDerivedKey);

                let receiverKey = receiverDerivedKey.XValue + receiverDerivedKey.YValue;
                let decryptMsg = Crypto.AES.decrypt(secret, receiverKey);
                return decryptMsg;
            },

        ecparams: EllipticCurve.getSECCurveByName("secp256k1"),
        getPubKeyHex: function(privateKeyHex){
          var key = new Bitcoin.ECKey(privateKeyHex);
          if(key.priv == null){
            console.log("Invalid Private key");
            return;
          }
          key.setCompressed(true);
          var pubkeyHex = key.getPubKeyHex();
          return pubkeyHex;
        },
        getFLOIDfromPubkeyHex: function(pubkeyHex){
          var key =  new Bitcoin.ECKey().setPub(pubkeyHex);
          var floID = key.getBitcoinAddress();
          return floID;
        },
        validateAddr: function (value) {
            try{
                var addr = new Bitcoin.Address(value);
                if (addr == value)
                    return true;
                else
                    return false;
            }catch(error){
                return false;
            }
        },
        verifyWIF: function (wif,addr){
            try {
                var key = new Bitcoin.ECKey(wif);
                if(key.priv == null){
                    return false;
                }
                key.setCompressed(true);
                var bitcoinAddress = key.getBitcoinAddress();
                if (addr == bitcoinAddress)
                    return true;
                else
                    return false;
            }
            catch (error) {
                console.log(error);
            }
        },
        sign: function (msg, privateKeyHex) {
            var key = new Bitcoin.ECKey(privateKeyHex);
            key.setCompressed(true);

            var privateKeyArr = key.getBitcoinPrivateKeyByteArray();
            privateKey = BigInteger.fromByteArrayUnsigned(privateKeyArr);
            var messageHash = Crypto.SHA256(msg);

            var messageHashBigInteger = new BigInteger(messageHash);
            var messageSign = Bitcoin.ECDSA.sign(messageHashBigInteger, key.priv);

            var sighex = Crypto.util.bytesToHex(messageSign);
            return sighex;
        },
        verify: function (msg, signatureHex, publicKeyHex) {
            var msgHash = Crypto.SHA256(msg);
            var messageHashBigInteger = new BigInteger(msgHash);

            var sigBytes = Crypto.util.hexToBytes(signatureHex);
            var signature = Bitcoin.ECDSA.parseSig(sigBytes);

            var publicKeyPoint = this.ecparams.getCurve().decodePointHex(publicKeyHex);

            var verify = Bitcoin.ECDSA.verifyRaw(messageHashBigInteger, signature.r, signature.s,
                publicKeyPoint);
            return verify;
        },
        wifToDecimal: function(pk_wif, isPubKeyCompressed = false) {
                let pk = Bitcoin.Base58.decode(pk_wif)
                pk.shift()
                pk.splice(-4, 4)
                //If the private key corresponded to a compressed public key, also drop the last byte (it should be 0x01).
                if (isPubKeyCompressed == true) pk.pop()
                pk.unshift(0)
                privateKeyDecimal = BigInteger(pk).toString()
                privateKeyHex = Crypto.util.bytesToHex(pk)
                return {
                    privateKeyDecimal: privateKeyDecimal,
                    privateKeyHex: privateKeyHex
                }
        },
        createShamirsSecretShares: function (str, total_shares, threshold_limit) {
                if (str.length > 0) {
                    // convert the text into a hex string
                    var strHex = shamirSecretShare.str2hex(str);
                    // split into total_shares shares, with a threshold of threshold_limit
                    var shares = shamirSecretShare.share(strHex, total_shares, threshold_limit);
                    return shares;
                }
                return false;
        },
        verifyShamirsSecret: function (sharesArray, str) {
                // combine sharesArray:
                var comb = shamirSecretShare.combine(sharesArray);
                //convert back to UTF string:
                comb = shamirSecretShare.hex2str(comb);
                return comb === str;
        },
        retrieveShamirSecret: function (sharesArray) {
                if (sharesArray.length > 0) {
                    // combine sharesArray:
                    var comb = shamirSecretShare.combine(sharesArray.slice(0, sharesArray.length));
                    //convert back to UTF string:
                    comb = shamirSecretShare.hex2str(comb);
                    return comb;
                }
                return false;
        }
      }

function convertStringToInt(string){
  return parseInt(string,10);
}

function arrayToObject(array){
      obj = {};
      array.forEach(element => {
        obj[element.floID] = {onionAddr : element.onionAddr, name : element.name, pubKey : element.pubKey};
      });
      return obj;
}

function getTime(time){
  var t = new Date(time);
  var fn = function(n){
    if(n<10)
      return '0'+n;
    else
      return n;
  };
  var tmp = `${months[t.getMonth()]} ${fn(t.getDate())} ${t.getFullYear()} ${fn(t.getHours())}:${fn(t.getMinutes())}`;
  return tmp;
}

function logout(){
  sessionStorage.clear();
  window.location.href = "index.html";
}

/*Refresh profile and superNode data from API */
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

function reloadInitData(){
    refreshAPIdata().then(result => {
        console.log(result);
        sessionStorage.profiles = JSON.stringify(profiles);
        sessionStorage.superNodeList = JSON.stringify(Array.from(superNodeList));
        kBucketObj.launchKBucket().then(result => {
            console.log(result)
        }).catch(error => {
            console.log(error);
        });
    }).catch(error => {
        console.log(error);
    });
}

function refreshAPIdata(){
    return new Promise((resolve,reject) => {
        var addr = adminID;
        var idb = indexedDB.open("FLO_Tweet");
        idb.onerror = (event) => { reject("Error in opening IndexedDB!") };
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
                                    if(data.addNodes)
                                        for(var i=0; i<data.addNodes.length; i++)
                                            superNodeList.add(data.addNodes[i])
                                    if(data.removeNodes)
                                        for(var i=0; i<data.removeNodes.length; i++)
                                            superNodeList.delete(data.removeNodes[i])
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
                                    profiles[data.floID] = {onionAddr : data.onionAddr, name : data.name, pubKey : data.pubKey};
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

/* Common IDB functions */
function storeProfile(data){
    return new Promise((resolve,reject) =>  {
          var idb = indexedDB.open("FLO_Tweet");
          idb.onerror = (event) => { console.log("Error in opening IndexedDB!") };
          idb.onsuccess = (event) => {
              var db = event.target.result;
              var obs = db.transaction('profiles', "readwrite").objectStore('profiles');
              objectRequest = obs.put(data);
              objectRequest.onerror = (event) => { reject(Error('Error occured: Unable to store data'))};
              objectRequest.onsuccess = (event) => { resolve('Data saved OK') };
              db.close();
          };
    });
}

function storeSuperNodeData(data){
    return new Promise((resolve,reject) => {
        var idb = indexedDB.open("FLO_Tweet");
        idb.onerror = (event) => { reject("Error in opening IndexedDB!"); };
        idb.onsuccess = (event) => {
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
    });
}

function storeTweet(data,tid){
  var idb = indexedDB.open("FLO_Tweet");
  idb.onerror = (event) => { console.log("Error in opening IndexedDB!") };
  idb.onsuccess = (event) => {
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
  idb.onerror = (event) => { console.log("Error in opening IndexedDB!") };
  idb.onsuccess = (event) => {
    var db = event.target.result;
    var obs = db.transaction("messages", "readwrite").objectStore("messages");
    data.msgID = `${data.time}_${data.floID}`;
    obs.add(data);
    db.close();
  };
}

/* SuperNode functions */
function sendDataToSuperNode(floID,data){
    kBucketObj.determineClosestSupernode(floID).then(result=>{
      var superNodeWS = new WebSocket("ws://"+profiles[result[0].floID].onionAddr+"/ws");
      superNodeWS.onopen = function(ev){ 
          console.log(`Connected to ${floID}'s SuperNode!`);
          superNodeWS.send(data);
      };
      superNodeWS.onerror = function(ev) {console.log(`${floid}'s SuperNode is offline!`);};
      superNodeWS.onclose = function(ev) {console.log(`Disconnected from ${floid}'s SuperNode!`);};
    }).catch(e => {
      console.log(e.message);
    }); 
}

function superNodeMode(data){
    if(data.reqNewTweets){
        kBucketObj.determineClosestSupernode(data.floID).then(result => {
          if(result[0].floID == selfID)
            SuperNode_sendTweetsFromIDB(data.floID,data.tid,data.requestor);
        }).catch(error => {
          console.log(error);
        }); 
    }else if(data.newSuperNodeTweet){
        kBucketObj.determineClosestSupernode(data.floID).then(result => {
          if(result[0].floID == selfID)
          SuperNode_storeSuperNodeTweet(data.data,data.tid);
        }).catch(error => {
          console.log(error);
        }); 
    }else if(data.viaSuperNodeMsg){
        kBucketObj.determineClosestSupernode(data.to).then(result => {
          if(result[0].floID == selfID)
            SuperNode_storeViaSuperNodeMsg(data.from,data.to,data.data);
        }).catch(error => {
          console.log(error);
        }); 
    }else if(data.viaMsgreq){
        kBucketObj.determineClosestSupernode(data.floID).then(result => {
          if(result[0].floID == selfID)
          SuperNode_sendviaMsgFromIDB(data.floID);
        }).catch(error => {
          console.log(error);
        }); 
    }
}

function SuperNode_sendTweetsFromIDB(floID,tid,requestor){
  return new Promise((resolve,reject) => {
      var requestorWS = new WebSocket("ws://"+profiles[requestor].onionAddr+"/ws");
      requestorWS.onopen = (event) => { 
        console.log(`sending ${floID} tweets to ${requestor} Server!`);
        var idb = indexedDB.open("FLO_Tweet",2);
        idb.onerror = (event) => { reject("Error in opening IndexedDB!") };
        idb.onupgradeneeded = (event) => {
          var objectStore1 = event.target.result.createObjectStore("superNodeTweet",{ keyPath: 'tweetID' });
          objectStore1.createIndex('floID', 'floID', { unique: false });
          objectStore1.createIndex('tid', 'tid', { unique: false });
          objectStore1.createIndex('data', 'data', { unique: false });
          var objectStore2 = event.target.result.createObjectStore("viaSuperNodeMsg",{ keyPath: 'id',autoIncrement:true });
          objectStore2.createIndex('from', 'from', { unique: false });
          objectStore2.createIndex('to', 'to', { unique: false });
          objectStore2.createIndex('data', 'data', { unique: false });
        }
        idb.onsuccess = (event) => {
          var db = event.target.result;
          var obs = db.transaction("superNodeTweet", "readwrite").objectStore("superNodeTweet");
          var curReq = obs.openCursor();
          curReq.onsuccess = (event) => {
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
          curReq.onerror = (event) => { reject("Error in Reading tweets from IDB!") }
          db.close();
        };
      };
      requestorWS.onerror = (event) => { console.log(`${requestor} Server is offline!`) };
      requestorWS.onclose = (event) => { console.log(`Disconnected from ${requestor} Server!`) };
  });
}        

function SuperNode_storeSuperNodeTweet(data,tid){
  var idb = indexedDB.open("FLO_Tweet",2);
  idb.onerror = (event) => { console.log("Error in opening IndexedDB!") };
  idb.onupgradeneeded = (event) => {
    var objectStore1 = event.target.result.createObjectStore("superNodeTweet",{ keyPath: 'tweetID' });
    objectStore1.createIndex('floID', 'floID', { unique: false });
    objectStore1.createIndex('tid', 'tid', { unique: false });
    objectStore1.createIndex('data', 'data', { unique: false });
    var objectStore2 = event.target.result.createObjectStore("viaSuperNodeMsg",{ keyPath: 'id',autoIncrement:true });
    objectStore2.createIndex('from', 'from', { unique: false });
    objectStore2.createIndex('to', 'to', { unique: false });
    objectStore2.createIndex('data', 'data', { unique: false });
  }
  idb.onsuccess = (event) => {
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
    idb.onerror = (event) => { console.log("Error in opening IndexedDB!") };
    idb.onupgradeneeded = (event) => {
      var objectStore1 = event.target.result.createObjectStore("superNodeTweet",{ keyPath: 'tweetID' });
      objectStore1.createIndex('floID', 'floID', { unique: false });
      objectStore1.createIndex('tid', 'tid', { unique: false });
      objectStore1.createIndex('data', 'data', { unique: false });
      var objectStore2 = event.target.result.createObjectStore("viaSuperNodeMsg",{ keyPath: 'id',autoIncrement :true });
      objectStore2.createIndex('from', 'from', { unique: false });
      objectStore2.createIndex('to', 'to', { unique: false });
      objectStore2.createIndex('data', 'data', { unique: false });
    }
    idb.onsuccess = (event) => {
      var db = event.target.result;
      var obs = db.transaction("viaSuperNodeMsg", "readwrite").objectStore("viaSuperNodeMsg");
      obs.add({from:from,to:to,data:data});
      db.close();
    };
  }
  
function SuperNode_sendviaMsgFromIDB(floID){
  var receiverWS = new WebSocket("ws://"+profiles[floID].onionAddr+"/ws");
  receiverWS.onopen = (event) => { 
    var idb = indexedDB.open("FLO_Tweet",2);
    idb.onerror = (event) => { console.log("Error in opening IndexedDB!") };
    idb.onupgradeneeded = (event) => {
      var objectStore1 = event.target.result.createObjectStore("superNodeTweet",{ keyPath: 'tweetID' });
      objectStore1.createIndex('floID', 'floID', { unique: false });
      objectStore1.createIndex('tid', 'tid', { unique: false });
      objectStore1.createIndex('data', 'data', { unique: false });
      var objectStore2 = event.target.result.createObjectStore("viaSuperNodeMsg",{ keyPath: 'id',autoIncrement:true });
      objectStore2.createIndex('from', 'from', { unique: false });
      objectStore2.createIndex('to', 'to', { unique: false });
      objectStore2.createIndex('data', 'data', { unique: false });
    };
    idb.onsuccess = (event) => {
      var db = event.target.result;
      var obs = db.transaction("viaSuperNodeMsg", "readwrite").objectStore("viaSuperNodeMsg");
      obs.openCursor().onsuccess = (event) => {
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
  receiverWS.onerror = (event) => { console.log('Connection Error to '+floID) };
  receiverWS.onclose = (event) => { console.log('Disconnected from '+floID) };
}

/* ---end of app.js --- */

/*Kademlia DHT K-bucket implementation as a binary tree.*/

if (typeof reactor == "undefined" || !reactor) {
    (function () {

        function Event(name) {
            this.name = name;
            this.callbacks = [];
        }
        Event.prototype.registerCallback = function (callback) {
            this.callbacks.push(callback);
        };

        function Reactor() {
            this.events = {};
        }

        Reactor.prototype.registerEvent = function (eventName) {
            var event = new Event(eventName);
            this.events[eventName] = event;
        };

        Reactor.prototype.dispatchEvent = function (eventName, eventArgs) {
            this.events[eventName].callbacks.forEach(function (callback) {
                callback(eventArgs);
            });
        };

        Reactor.prototype.addEventListener = function (eventName, callback) {
            this.events[eventName].registerCallback(callback);
        };

        window.reactor = new Reactor();

    })();
}

reactor.registerEvent('added');
reactor.addEventListener('added', function (someObject) {
    console.log('Added fired with data ' + someObject);
});

reactor.registerEvent('removed');
reactor.addEventListener('removed', function (someObject) {
    console.log('Removed fired with data ' + someObject);
});

reactor.registerEvent('updated');
reactor.addEventListener('updated', function (someObject) {
    console.log('Updated fired with data ' + someObject);
});

reactor.registerEvent('bucket_full');
reactor.addEventListener('bucket_full', function (someObject) {
    console.log('Bucket full ' + someObject);
});


    /**
    * @param  {Uint8Array} array1
    * @param  {Uint8Array} array2
    * @return {Boolean}
    */
    function arrayEquals(array1, array2) {
        if (array1 === array2) {
            return true
        }
        if (array1.length !== array2.length) {
            return false
        }
        for (let i = 0, length = array1.length; i < length; ++i) {
            if (array1[i] !== array2[i]) {
                return false
            }
        }
        return true
    }

    function createNode() {
        return {
            contacts: [],
            dontSplit: false,
            left: null,
            right: null
        }
    }

    function ensureInt8(name, val) {
        if (!(val instanceof Uint8Array)) {
            throw new TypeError(name + ' is not a Uint8Array')
        }
    }

    /**
    * Implementation of a Kademlia DHT k-bucket used for storing
    * contact (peer node) information.
    *
    * @extends EventEmitter
    */
    function BuildKBucket(options = {}) {
        /**
        * `options`:
        *   `distance`: Function
        *     `function (firstId, secondId) { return distance }` An optional
        *     `distance` function that gets two `id` Uint8Arrays
        *     and return distance (as number) between them.
        *   `arbiter`: Function (Default: vectorClock arbiter)
        *     `function (incumbent, candidate) { return contact; }` An optional
        *     `arbiter` function that givent two `contact` objects with the same `id`
        *     returns the desired object to be used for updating the k-bucket. For
        *     more details, see [arbiter function](#arbiter-function).
        *   `localNodeId`: Uint8Array An optional Uint8Array representing the local node id.
        *     If not provided, a local node id will be created via `randomBytes(20)`.
        *     `metadata`: Object (Default: {}) Optional satellite data to include
        *     with the k-bucket. `metadata` property is guaranteed not be altered by,
        *     it is provided as an explicit container for users of k-bucket to store
        *     implementation-specific data.
        *   `numberOfNodesPerKBucket`: Integer (Default: 20) The number of nodes
        *     that a k-bucket can contain before being full or split.
        *     `numberOfNodesToPing`: Integer (Default: 3) The number of nodes to
        *     ping when a bucket that should not be split becomes full. KBucket will
        *     emit a `ping` event that contains `numberOfNodesToPing` nodes that have
        *     not been contacted the longest.
        *
        * @param {Object=} options optional
        */

        this.localNodeId = options.localNodeId || window.crypto.getRandomValues(new Uint8Array(20))
        this.numberOfNodesPerKBucket = options.numberOfNodesPerKBucket || 20
        this.numberOfNodesToPing = options.numberOfNodesToPing || 3
        this.distance = options.distance || this.distance
        // use an arbiter from options or vectorClock arbiter by default
        this.arbiter = options.arbiter || this.arbiter
        this.metadata = Object.assign({}, options.metadata)

        ensureInt8('option.localNodeId as parameter 1', this.localNodeId)

        this.root = createNode()


        /**
        * Default arbiter function for contacts with the same id. Uses
        * contact.vectorClock to select which contact to update the k-bucket with.
        * Contact with larger vectorClock field will be selected. If vectorClock is
        * the same, candidat will be selected.
        *
        * @param  {Object} incumbent Contact currently stored in the k-bucket.
        * @param  {Object} candidate Contact being added to the k-bucket.
        * @return {Object}           Contact to updated the k-bucket with.
        */
        this.arbiter = function (incumbent, candidate) {
            return incumbent.vectorClock > candidate.vectorClock ? incumbent : candidate
        }

        /**
        * Default distance function. Finds the XOR
        * distance between firstId and secondId.
        *
        * @param  {Uint8Array} firstId  Uint8Array containing first id.
        * @param  {Uint8Array} secondId Uint8Array containing second id.
        * @return {Number}              Integer The XOR distance between firstId
        *                               and secondId.
        */
        this.distance = function (firstId, secondId) {
            let distance = 0
            let i = 0
            const min = Math.min(firstId.length, secondId.length)
            const max = Math.max(firstId.length, secondId.length)
            for (; i < min; ++i) {
                distance = distance * 256 + (firstId[i] ^ secondId[i])
            }
            for (; i < max; ++i) distance = distance * 256 + 255
            return distance
        }

        /**
        * Adds a contact to the k-bucket.
        *
        * @param {Object} contact the contact object to add
        */
        this.add = function (contact) {
            ensureInt8('contact.id', (contact || {}).id)

            let bitIndex = 0
            let node = this.root

            while (node.contacts === null) {
                // this is not a leaf node but an inner node with 'low' and 'high'
                // branches; we will check the appropriate bit of the identifier and
                // delegate to the appropriate node for further processing
                node = this._determineNode(node, contact.id, bitIndex++)
            }

            // check if the contact already exists
            const index = this._indexOf(node, contact.id)
            if (index >= 0) {
                this._update(node, index, contact)
                return this
            }

            if (node.contacts.length < this.numberOfNodesPerKBucket) {
                node.contacts.push(contact)
                reactor.dispatchEvent('added', contact)
                return this
            }

            // the bucket is full
            if (node.dontSplit) {
                // we are not allowed to split the bucket
                // we need to ping the first this.numberOfNodesToPing
                // in order to determine if they are alive
                // only if one of the pinged nodes does not respond, can the new contact
                // be added (this prevents DoS flodding with new invalid contacts)
                reactor.dispatchEvent('bucket_full', {1: node.contacts.slice(0, this.numberOfNodesToPing),2: contact})
                return this
            }

            this._split(node, bitIndex)
            return this.add(contact)
        }

        /**
        * Get the n closest contacts to the provided node id. "Closest" here means:
        * closest according to the XOR metric of the contact node id.
        *
        * @param  {Uint8Array} id  Contact node id
        * @param  {Number=} n      Integer (Default: Infinity) The maximum number of
        *                          closest contacts to return
        * @return {Array}          Array Maximum of n closest contacts to the node id
        */
        this.closest = function (id, n = Infinity) {
            ensureInt8('id', id)

            if ((!Number.isInteger(n) && n !== Infinity) || n <= 0) {
                throw new TypeError('n is not positive number')
            }

            let contacts = []

            for (let nodes = [this.root], bitIndex = 0; nodes.length > 0 && contacts.length < n;) {
                const node = nodes.pop()
                if (node.contacts === null) {
                    const detNode = this._determineNode(node, id, bitIndex++)
                    nodes.push(node.left === detNode ? node.right : node.left)
                    nodes.push(detNode)
                } else {
                    contacts = contacts.concat(node.contacts)
                }
            }

            return contacts
                .map(a => [this.distance(a.id, id), a])
                .sort((a, b) => a[0] - b[0])
                .slice(0, n)
                .map(a => a[1])
        }

        /**
        * Counts the total number of contacts in the tree.
        *
        * @return {Number} The number of contacts held in the tree
        */
        this.count = function () {
            // return this.toArray().length
            let count = 0
            for (const nodes = [this.root]; nodes.length > 0;) {
                const node = nodes.pop()
                if (node.contacts === null) nodes.push(node.right, node.left)
                else count += node.contacts.length
            }
            return count
        }

        /**
        * Determines whether the id at the bitIndex is 0 or 1.
        * Return left leaf if `id` at `bitIndex` is 0, right leaf otherwise
        *
        * @param  {Object} node     internal object that has 2 leafs: left and right
        * @param  {Uint8Array} id   Id to compare localNodeId with.
        * @param  {Number} bitIndex Integer (Default: 0) The bit index to which bit
        *                           to check in the id Uint8Array.
        * @return {Object}          left leaf if id at bitIndex is 0, right leaf otherwise.
        */
        this._determineNode = function (node, id, bitIndex) {
            // *NOTE* remember that id is a Uint8Array and has granularity of
            // bytes (8 bits), whereas the bitIndex is the bit index (not byte)

            // id's that are too short are put in low bucket (1 byte = 8 bits)
            // (bitIndex >> 3) finds how many bytes the bitIndex describes
            // bitIndex % 8 checks if we have extra bits beyond byte multiples
            // if number of bytes is <= no. of bytes described by bitIndex and there
            // are extra bits to consider, this means id has less bits than what
            // bitIndex describes, id therefore is too short, and will be put in low
            // bucket
            const bytesDescribedByBitIndex = bitIndex >> 3
            const bitIndexWithinByte = bitIndex % 8
            if ((id.length <= bytesDescribedByBitIndex) && (bitIndexWithinByte !== 0)) {
                return node.left
            }

            const byteUnderConsideration = id[bytesDescribedByBitIndex]

            // byteUnderConsideration is an integer from 0 to 255 represented by 8 bits
            // where 255 is 11111111 and 0 is 00000000
            // in order to find out whether the bit at bitIndexWithinByte is set
            // we construct (1 << (7 - bitIndexWithinByte)) which will consist
            // of all bits being 0, with only one bit set to 1
            // for example, if bitIndexWithinByte is 3, we will construct 00010000 by
            // (1 << (7 - 3)) -> (1 << 4) -> 16
            if (byteUnderConsideration & (1 << (7 - bitIndexWithinByte))) {
                return node.right
            }

            return node.left
        }

        /**
        * Get a contact by its exact ID.
        * If this is a leaf, loop through the bucket contents and return the correct
        * contact if we have it or null if not. If this is an inner node, determine
        * which branch of the tree to traverse and repeat.
        *
        * @param  {Uint8Array} id The ID of the contact to fetch.
        * @return {Object|Null}   The contact if available, otherwise null
        */
        this.get = function (id) {
            ensureInt8('id', id)

            let bitIndex = 0

            let node = this.root
            while (node.contacts === null) {
                node = this._determineNode(node, id, bitIndex++)
            }

            // index of uses contact id for matching
            const index = this._indexOf(node, id)
            return index >= 0 ? node.contacts[index] : null
        }

        /**
        * Returns the index of the contact with provided
        * id if it exists, returns -1 otherwise.
        *
        * @param  {Object} node    internal object that has 2 leafs: left and right
        * @param  {Uint8Array} id  Contact node id.
        * @return {Number}         Integer Index of contact with provided id if it
        *                          exists, -1 otherwise.
        */
        this._indexOf = function (node, id) {
            for (let i = 0; i < node.contacts.length; ++i) {
                if (arrayEquals(node.contacts[i].id, id)) return i
            }

            return -1
        }

        /**
        * Removes contact with the provided id.
        *
        * @param  {Uint8Array} id The ID of the contact to remove.
        * @return {Object}        The k-bucket itself.
        */
        this.remove = function (id) {
            ensureInt8('the id as parameter 1', id)

            let bitIndex = 0
            let node = this.root

            while (node.contacts === null) {
                node = this._determineNode(node, id, bitIndex++)
            }

            const index = this._indexOf(node, id)
            if (index >= 0) {
                const contact = node.contacts.splice(index, 1)[0]
                reactor.dispatchEvent('removed', contact)
            }

            return this
        }

        /**
        * Splits the node, redistributes contacts to the new nodes, and marks the
        * node that was split as an inner node of the binary tree of nodes by
        * setting this.root.contacts = null
        *
        * @param  {Object} node     node for splitting
        * @param  {Number} bitIndex the bitIndex to which byte to check in the
        *                           Uint8Array for navigating the binary tree
        */
        this._split = function (node, bitIndex) {
            node.left = createNode()
            node.right = createNode()

            // redistribute existing contacts amongst the two newly created nodes
            for (const contact of node.contacts) {
                this._determineNode(node, contact.id, bitIndex).contacts.push(contact)
            }

            node.contacts = null // mark as inner tree node

            // don't split the "far away" node
            // we check where the local node would end up and mark the other one as
            // "dontSplit" (i.e. "far away")
            const detNode = this._determineNode(node, this.localNodeId, bitIndex)
            const otherNode = node.left === detNode ? node.right : node.left
            otherNode.dontSplit = true
        }

        /**
        * Returns all the contacts contained in the tree as an array.
        * If this is a leaf, return a copy of the bucket. `slice` is used so that we
        * don't accidentally leak an internal reference out that might be
        * accidentally misused. If this is not a leaf, return the union of the low
        * and high branches (themselves also as arrays).
        *
        * @return {Array} All of the contacts in the tree, as an array
        */
        this.toArray = function () {
            let result = []
            for (const nodes = [this.root]; nodes.length > 0;) {
                const node = nodes.pop()
                if (node.contacts === null) nodes.push(node.right, node.left)
                else result = result.concat(node.contacts)
            }
            return result
        }

        /**
        * Updates the contact selected by the arbiter.
        * If the selection is our old contact and the candidate is some new contact
        * then the new contact is abandoned (not added).
        * If the selection is our old contact and the candidate is our old contact
        * then we are refreshing the contact and it is marked as most recently
        * contacted (by being moved to the right/end of the bucket array).
        * If the selection is our new contact, the old contact is removed and the new
        * contact is marked as most recently contacted.
        *
        * @param  {Object} node    internal object that has 2 leafs: left and right
        * @param  {Number} index   the index in the bucket where contact exists
        *                          (index has already been computed in a previous
        *                          calculation)
        * @param  {Object} contact The contact object to update.
        */
        this._update = function (node, index, contact) {
            // sanity check
            if (!arrayEquals(node.contacts[index].id, contact.id)) {
                throw new Error('wrong index for _update')
            }

            const incumbent = node.contacts[index]

            /***************Change made by Abhishek*************/
            const selection = this.arbiter(incumbent, contact)
            //const selection = localbitcoinplusplus.kademlia.arbiter(incumbent, contact);
            // if the selection is our old contact and the candidate is some new
            // contact, then there is nothing to do
            if (selection === incumbent && incumbent !== contact) return

            node.contacts.splice(index, 1) // remove old contact
            node.contacts.push(selection) // add more recent contact version
            /***************Change made by Abhishek*************/
            reactor.dispatchEvent('updated', {
                ...incumbent,
                ...selection
            })
            //reactor.dispatchEvent('updated', incumbent.concat(selection))
        }
    }
  

kBucketObj = {

    decodeBase58Address: function (address) {
        let k = bitjs.Base58.decode(address)
        k.shift()
        k.splice(-4, 4)
        return Crypto.util.bytesToHex(k)
    },
    launchKBucket: function() {
        return new Promise((resolve, reject)=>{
            try {
                //const master_flo_pubKey = localbitcoinplusplus.master_configurations.masterFLOPubKey;
                const master_flo_addr = adminID;
                const SuKBucketId = this.floIdToKbucketId(master_flo_addr);
                const SukbOptions = { localNodeId: SuKBucketId }
                supernodeKBucket = new BuildKBucket(SukbOptions);
                var SNArray = Array.from(superNodeList);
                for(var i=0; i<SNArray.length ; i++)
                    this.addNewUserNodeInKbucket(SNArray[i],supernodeKBucket)
                resolve('SuperNode KBucket formed');
            } catch (error) {
                reject(error);
            }
        });
    },
    launchSupernodesKBucket: function() {
        
        localbitcoinplusplus.master_configurations.supernodesPubKeys.map(pubKey=>{
            return new Promise((resolve, reject)=>{
                try {
                    let flo_id = bitjs.pubkey2address(pubKey);
                    let kname = `SKBucket_${pubKey}`;
                    const KBucketId = this.floIdToKbucketId(flo_id)
                    const kbOptions = { localNodeId: KBucketId }
                    window[kname] = new BuildKBucket(kbOptions);
                    resolve(true);
                } catch (error) {
                    reject(error);
                }
            })
        })
    },
    addContact: function (id, floID, KB=supernodeKBucket) {
        const contact = {
            id: id,
            floID: floID
        };
        KB.add(contact)
    },
    addNewUserNodeInKbucket: function(address, KB=supernodeKBucket) {
        let decodedId = address;   
        try { 
            decodedId = this.floIdToKbucketId(address);
        } catch(e) {
            decodedId = address;
        } 
        const addNewUserNode = this.addContact(decodedId, address, KB);
        return {decodedId:decodedId, address:address};
    },
    floIdToKbucketId: function (address) {
        const decodedId = this.decodeBase58Address(address);
        const nodeIdBigInt =  new BigInteger(decodedId, 16);
        const nodeIdBytes = nodeIdBigInt.toByteArrayUnsigned();
        const nodeIdNewInt8Array =  new Uint8Array(nodeIdBytes);
        return nodeIdNewInt8Array;
    },
    arbiter: function (incumbent, candidate) {
        // we create a new object so that our selection is guaranteed to replace
        // the incumbent
        const merged = {
            id: incumbent.id, // incumbent.id === candidate.id within an arbiter
            data: incumbent.data
        }

        Object.keys(candidate.data).forEach(workerNodeId => {
            merged.data[workerNodeId] = candidate.data[workerNodeId];
        })

        return merged;
    },
    newBase64DiscoverId: function (pubKey) {
        let pubKeyBytes = Crypto.util.hexToBytes(pubKey);
        return Crypto.util.bytesToBase64(pubKeyBytes);
    },
    restoreKbucket: function(flo_addr, KB=KBucket) {
        return new Promise((resolve, reject)=>{
            readAllDB('kBucketStore')
            .then(dbObject => {
                if (typeof dbObject=="object") {
                    let su_flo_addr_array = localbitcoinplusplus.master_configurations.supernodesPubKeys  
                            .map(pubk=>bitjs.pubkey2address(pubk));
                    // Prevent supernode to re-added in kbucket
                    dbObject
                    .filter(f=>!su_flo_addr_array.includes(f.data.id))
                    .map(dbObj=>{
                        this.addNewUserNodeInKbucket(flo_addr, dbObj.data, KB);
                    });
                } else {
                    reject(`Failed to restore kBucket.`);
                }
                resolve(dbObject);
            });
        })
    },
    restoreSupernodeKBucket: function() {
        return new Promise((resolve, reject)=>{
            const supernodeSeeds = localbitcoinplusplus.master_configurations.supernodeSeeds;
            if (typeof supernodeSeeds !== "object") reject("Failed to get supernode seeds.");
            let supernodeSeedsObj = JSON.parse(supernodeSeeds);
            
            Object.entries(supernodeSeedsObj).map(seedObj=>{
                let kbuck = this.addNewUserNodeInKbucket(seedObj[1].kbucketId, 
                    { id: seedObj[1].kbucketId }, supernodeKBucket);
            });

            resolve(true);
        })
    },
    updateClosestSupernodeSeeds: function(flo_addr) {
        return new Promise(async (resolve, reject) => {
            await removeAllinDB('myClosestSupernodes');
            let nearestSupernodeAddresslist = await this.addClosestSupernodeInDB(flo_addr);
            nearestSupernodeAddresslist.map((nearestSupernodeAddress, index)=>{
                updateinDB('myClosestSupernodes', {
                    id: index+1,
                    ip: nearestSupernodeAddress.ip,
                    port: nearestSupernodeAddress.port,
                    trader_flo_address: nearestSupernodeAddress.kbucketId,
                    is_live: null
                }).then(updatedClosestSupernodes=>{
                    readAllDB('myClosestSupernodes').then(nearestSupernodeAddresslist=>{
                        showMessage(`INFO: Updated closest supernodes list successfully.`);
                        resolve(nearestSupernodeAddresslist);
                    });
                });
            });
        });
    },
    getSupernodeSeed: function (flo_addr) {
        return new Promise(async (resolve, reject) => {
            let nearestSupernodeAddresslist = await readAllDB('myClosestSupernodes');
            if (nearestSupernodeAddresslist.length<1) {
                nearestSupernodeAddresslist = await this.updateClosestSupernodeSeeds(flo_addr);
            }
            resolve(nearestSupernodeAddresslist);
        });
    },
    isNodePresentInMyKbucket: function(flo_id, KB=KBucket) {
        return new Promise((resolve, reject)=>{
            let kArray = KB.toArray();
            let kArrayFloIds = kArray.map(k=>k.data.id);
            if (kArrayFloIds.includes(flo_id)) {
                resolve(true);
            } else {
                reject(false);
            }
        });
    },
    determineClosestSupernode: function(flo_addr="", n=1, KB=supernodeKBucket, su="") {
        return new Promise((resolve, reject)=>{
            let msg = ``;
            if (typeof supernodeKBucket !== "object") {
                msg = `ERROR: Supernode KBucket not found.`;
                showMessage(msg);
                reject(msg);
                return false;
            }

            if (su.length>0) {
                try {
                    let closestSupernodeMasterList = supernodeKBucket.closest(supernodeKBucket.localNodeId);
                    const index = closestSupernodeMasterList.findIndex(f=>f.data.id==su);
                    let tail = closestSupernodeMasterList.splice(0, index);
                    const newClosestSupernodeMasterList = closestSupernodeMasterList.concat(tail);
                    resolve(newClosestSupernodeMasterList);
                    return true;
                } catch (error) {
                    reject(error);
                }
                return false;
            }
            
            try {
                if(flo_addr.length < 0) {
                    showMessage(`WARNING: No Flo Id provided to determine closest Supenode.`);
                    return;
                }
                let isFloIdUint8 = flo_addr instanceof Uint8Array;
                if (!isFloIdUint8) {
                    flo_addr = this.floIdToKbucketId(flo_addr);
                }
                const closestSupernode = supernodeKBucket.closest(flo_addr, n);
                resolve(closestSupernode);
                return true;
            } catch (error) {
                showMessage(error);
                reject(error);
                return false;
            }
        })
    }
}
