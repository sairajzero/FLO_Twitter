#!/bin/sh

cat <<EOT >> /etc/tor/torrc
HiddenServiceDir $PWD/.hidden_service/
HiddenServicePort 80 127.0.0.1:8080
EOT
mkdir $PWD/.hidden_service
chmod 700 $PWD/.hidden_service