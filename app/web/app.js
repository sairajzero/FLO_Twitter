
window.indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
window.IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction || window.msIDBTransaction;
window.IDBKeyRange = window.IDBKeyRange || window.webkitIDBKeyRange || window.msIDBKeyRange;
   
if (!window.indexedDB) {
     window.alert("Your browser doesn't support a stable version of IndexedDB.")
}

var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

var encrypt = {

            p: BigInteger("FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F", 16),

            exponent1: function () {
                return encrypt.p.add(BigInteger.ONE).divide(BigInteger("4"))
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
                console.log("senderDerivedKey", senderDerivedKey);
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
                console.log("receiverDerivedKey", receiverDerivedKey);

                let receiverKey = receiverDerivedKey.XValue + receiverDerivedKey.YValue;
                let decryptMsg = Crypto.AES.decrypt(secret, receiverKey);
                return decryptMsg;
            },

        ecparams: EllipticCurve.getSECCurveByName("secp256k1"),
        getPubKeyHex: function(privateKeyHex){
          var key = new Bitcoin.ECKey(privateKeyHex);
          if(key.priv == null){
            alert("Invalid Private key");
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
  location.reload();
}

function listProfiles(){
  console.log("listProfiles");
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