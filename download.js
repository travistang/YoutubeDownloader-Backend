const ytdl     = require('ytdl-core')
const ffmpeg   = require('fluent-ffmpeg');
var kue = require('kue')
 , queue = kue.createQueue({
   prefix: 'q',
   redis: {
     port: 6379,
     host: 'localhost',
   }
 });

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
      .save(`${__dirname}/sample.mp3`)
      // .on('progress', (p) => {
      //   console.log('progress')
      //   job.progress(download,total)
      // })
      .on('end', () => {
        done()
      });
  }catch(err) {
    console.log('error encounted:' + JSON.stringify(err))
  }

}

// listen to kue here

queue.process('audio',downloadAudio)
