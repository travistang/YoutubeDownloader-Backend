/*
  Consume tasks ONE AT A TIME,
  - do the actual video downloading,
  - do the video conversion,
  - dispatch progress to the progress channel
*/
const ytdl     = require('ytdl-core')
const ffmpeg   = require('fluent-ffmpeg');
const {
  queueHost,
  amqpTopic,
  amqpPort,reportProgressChannel,
  queue,
  publisher
} = require('../endpoint/workerMessanger')
var kue = require('kue')
 // , queue = kue.createQueue({
 //   prefix: 'q',
 //   redis: {
 //     port: amqpPort,
 //     host: queueHost,
 //   }
 // });

const downloadAudio = (job,done) => {

  let id = job.data.id
  console.log('begin download audio!')
  try {
    let stream = ytdl(id, {
      quality: 'highestaudio',
    });
    let download = 0
    let total = 0
    stream.on('progress',(c,d,t) => {
      download = d
      total = t
      job.progress(download,total)
    })

    ffmpeg(stream)
      .audioBitrate(128)
      .save(`${(job.data.id)}.mp3`)
      // .on('progress', (p) => {
      //   console.log('progress')
      //   job.progress(download,total)
      // })
      .on('end', () => {
        done()
      });
  }catch(err) {
    console.log('error encounted:' + JSON.stringify(err))
    job.failed().error(err)
  }

}

// listen to kue here
queue.process(amqpTopic,downloadAudio)
