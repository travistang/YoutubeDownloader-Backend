from node:8

workdir /app
run cd /app && npm install express cors http socket.io cheerio request youtube-dl axios mongoose kue
add *.js /app/

entrypoint node /app/producer.js
