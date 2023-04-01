#!/bin/sh

tor &
npm start -- -u=$U &
sleep 5s
cat args/.hidden_service/hostname
wait