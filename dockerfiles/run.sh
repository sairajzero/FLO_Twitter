#!/bin/sh

tor &
npm start --prefix ./app -- -u=$U &
sleep 5s
cat .hidden_service/hostname
wait