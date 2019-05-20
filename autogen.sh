#!/bin/sh
echo "----------Welcome to FLO-Whatsapp AutoGen----------"

if [ $(whoami) != "root" ];then
	echo "Permission Denied! Try sudo $0";
	exit 1
fi

if [ -f start ]; then
	echo "FLO-Twitter is already AutoGen"
	echo "To start run :\n./start <server-password>"
	exit 0
fi

echo "----------Installing TOR----------"
apt-get install tor
echo "----------Configuring Tor for FLO-Whatsapp----------"
echo $PWD
cat <<EOT >> /etc/tor/torrc
HiddenServiceDir $PWD/.hidden_service/
HiddenServicePort 3232 127.0.0.1:3232
EOT
chmod 700 $PWD
echo "----------Finished Configuring----------"
echo "----------Creating Start script----------"
cat > start << EOF
#!/bin/sh
if [ -z "\$1" ];then 
	echo "Enter server password as argument"
	exit 0
fi
app/tweeter \$1 &
tor &
sleep 5s
OA=\$(cat .hidden_service/hostname)
zenity --info --text="Open link '\$OA:3232' in onion browser"
wait
EOF
chmod +x start
echo "----------Finished AutoGen----------"
echo "To start run :\n./start <server-password>"

