
# FLO_Twitter 
This is a peer-peer Twitter like application totally encrypted in transit without needing a central server. 
Current web based technologies have a inbound address problem namely ordinary web users do not have a fixed IP, so it is not easy to establish connection to them.  
We propose to solve that problem by using TOR addresses for ordinary users which can provide a fixed inbound routable address on Internet for everyone including for those on dynamic IPs. 
The TOR Project very easy to connect to a TOR based service. We believe it can form a stable architecture for peer to peer services. 
Another limitation of current web based technologies is ordinary users cannot allocate a fixed port using just their web browsers for inbound connections. So every user will need to run their own webservers on which they can receive chat messages. We could not find a way to eliminate webservers. But we have found a very simple webserver called Mongoose Webserver, where a user can invoke a fixed port based service on click of a single button. 
To facilitate globally unique identification of every peer, we propose to use FLO Blockchain IDs. Then user can then attach his TOR address onto his FLO id inside the FLO Blockchain. 
Since the blockchain data is immutable, it will provide a continous uniterruptable source of connection information based on user's FLO ID.  

## Requirements
1. Ubuntu OS or its derivatives (or) Andoid
2. Onion Browser ([Brave]([https://brave.com/](https://brave.com/)) for Desktop or [Tor Browser](https://play.google.com/store/apps/details?id=org.torproject.torbrowser)/[Orbot](https://play.google.com/store/apps/details?id=org.torproject.android) for Android)
3. FLO ID

## Installation
The FLO_Twitter WSS can either run on Ubuntu OS or Android

#### Ubuntu
1. Download or Clone this repo

        git clone https://github.com/ranchimall/FLO_Twitter
2. Open terminal in the directory
        
        cd FLO_Twitter
3. Run `autogen.sh` to install tor, configure tor and create the start file.

		sudo ./autogen.sh
#### Android
1. Download and extract [FLO_Twitter](https://github.com/ranchimall/FLO_Twitter/archive/master.zip) to Internal Storage Home (`/storage/emulated/0/`) **Make sure it is extracted as FLO_Twitter** (if its extracted as FLO_Twitter-master.. rename it to FLO_Twitter). The extracted path should be `/storage/emulated/0/FLO_Twitter/`
2. Install the app using `util/FLO_Twitter.apk`
3. Install [Orbot](https://play.google.com/store/apps/details?id=org.torproject.android) 
4. Open Orbot 
	* Open Options (`:`) -> Hidden Services -> Hosted Services
		* Add New Service with local port and onion port as `3232` and save it
	* Enable `VPN Mode` and open :gear: 
		* add `FLO_Twitter` and the browser ([Orfox](https://play.google.com/store/apps/details?id=info.guardianproject.orfox) ll be enabled by default)
	

## Usage
The FLO_Twitter WSS should be started and then you can access it from any device. 
### Starting FLO_Twitter WSS
#### Ubuntu
1. run start in terminal (in the `FLO_Twitter` directory). Enter a strong `server-password` which will be used to connect in client.

        ./start <server-password>
2. `FLO_Twitter WSS` and `Tor` will be started automatically. (Hidden_service will be created on the 1st time). Your hidden_service `onion address` will be displayed in information dialog box
#### Android 
1. Open `FLO_Twitter` app
2. Open `Orbot` app and `Start`
	* Open Options (`:`) -> Hidden Services -> Hosted Services and Copy the `onion address`

**Bookmark the onion address (`<url>.onion:3232`) in the browser**

### Accessing the client webpages
1. Open the `onion address` (`<url>.onion:3232`) in Onion browser (`Brave` for desktop or `Tor Browser`/`Orbot`-enabled browsers for android) [not necessary to be on the same device]
3. Enter the `server-password` and click `Connect`. Access will be granted when entered correct server-password
4. Enter the `Username` and  `FLO_ID privKey`. (FLO_ID privKey can be generated using [flo_webWallet](https://flo-webwallet.duckdns.org/) or [flo-core wallet](https://github.com/ranchimall/FLO-wallet-core)). **FLO_ID private key is important! DO NOT lose or share it!**
5. Click `SignIn`. New users and users changing the onion address or username will require to register in the FLO blockchain. (The registration is automatic, just click on ok when prompted). A minimum amount will be required to register [Balance recharge can be done using https://international.bittrex.com/]. Upon successful registration the txid will be alerted
* **Now your are logged on to FLO_Twitter.**
### FLO_Twitter Features 
* Home 
	* Enter Tweet and post. 
	* Watch posted tweeted by users you follow
* Profile
	* Click on the profile list in right-side column to navigate to the respective user profiles
	* Watch tweets posted by an user
	* Follow or Unfollow the user
* Message
	* Click on the profile list to open the user chat
	* Send and Receive messages with the other users

**NOTE:**
 * All Tweets are Signed using the Tweeter's FLO_ID PrivKey
	* Hence all Tweets are verified by the Tweeter's PubKey
 * All  Messages are signed by the Sender's Privkey and Encrypted with Reciver's PubKey
	 * Only the Receiver can decrypt the message using their own PrivKey
	 * Message's signature is verified using Sender's PubKey
