from node:8

workdir /app
run apt update
run apt install -y libav-tools
run ln -s /usr/bin/avconv /usr/bin/ffmpeg
run npm install kue ytdl-core fluent-ffmpeg
add ./worker/*.js /app/
add ./endpoint/workerMessanger.js /app

entrypoint node /app/download.js
