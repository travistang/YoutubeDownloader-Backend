const express = require('express')
const app = express()
const server  = require('http').Server(app)
const io      = require('socket.io')(server)

const cheerio = require('cheerio')
const request = require('request')
const ytdl = require('youtube-dl')
const axios = require('axios')
const DBAdapter = require('./db')

//config
let mongoURL = 'mongodb://mongo:27017/yt'
let kueURL = 'http://localhost:3100'
let redisHostname = 'redis'

// connect to MongoDB
const db = new DBAdapter(mongoURL)
// connect to kue/redis
var kue = require('kue')
 , queue = kue.createQueue({
   prefix: 'q',
   redis: {
     port: 6379,
     host: redisHostname,
   }
 });

// serving static file
app.use('/storage',express.static('/storage'))
// kue queue query functions
const getJobStatusById = async (id) => {
  let resp = await axios.get(`${kueURL}/job/${id}`)
  return resp.data
}
// socket listeners
let socket = null
io.on('connection',s => {
  console.log('socket connected')
  socket = s
})

// TODO: check token collision
app.get('/audio/:id', async (req, res) => {
  let id = req.params.id
  let token = req.query.token

  // const db = new DBAdapter(mongoURL)
  if(!token) {
    res.status(400).send('missing token')
    return
  }
  if(!socket) {
    res.status(500).send('server not ready')
    return
  }
  if(id == 0) {
    res.status(400).send('missing ID')
    return
  }

// TODO: determine the path of downloading file here
  try {
    ytdl.getInfo(id,async (err,info) => {
        if(err) {
          res.status(400).send('invalid video ID')
        } else {
          let audioObj = await db.getAudioById(id)
          if(audioObj.length != 0) {
            // db.close()
            res.status(200).send({
              path: audioObj.path
            })
          } else {
            let job = queue.create('audio',{
              id
            })
            await db.createNewTask(job.id,token,id)
            job.on('start',async () => {
              console.log('job started')
              await db.assignTaskIdByVideoId(id,job.id)
              await db.updateTaskStatus(id,"started")
              await db.createNewAudio(info.title,id,`/storage/${id}.mp3`)
              socket.emit(token,{
                'type': 'started',
                id,
              })
            })
            job.on('failed',async () => {
              socket.emit(token,{
                type: 'failed',
                id
              })
              await db.updateTaskStatus(id,'failed')
              // db.close()
              // await Task.findOneAndUpdate({videoId: id},{status: 'failed'}).exec()
            })
            job.on('progress', async (progress) => {
              let payload = {progress,id,token,type: 'progress'}
              socket.emit(token,payload)
              await db.updateTaskStatus(id,'progress')
              // await Task.findOneAndUpdate({videoId: id},{status: 'progress'}).exec()
            })

            job.on('complete',async () => {
              socket.emit(token,{
                id,
                type: 'completed',
              })
              // db.close()
              await db.updateTaskStatus(id,"completed")
              // await Task.findOneAndUpdate({videoId: id},{status: 'completed'}).exec()
            })
            job.save(() => {
              res.status(200).send({id:job.id})
            })
          }

        }
      })
  }catch(err) {
    throw(err)
    res.status(500).send('server error')
  }

})
// inqure the status of a particular job
app.get('/status/:videoId',async (req,res) => {

  let token = req.query.token
  let videoId = req.params.videoId
  if(!token) {
    res.status(400).send('missing token')
    return
  }
  let taskDoc = await db.getTaskById(videoId)
  if(!taskDoc || taskDoc.token != token) {
    res.status(400).send('either there is no such task, or the token you provided is invalid')
    return
  }
  let jobId = taskDoc.id
  if(!jobId) {
    return {'status':'queuing'}
  }
  let status = await getJobStatusById(jobId)
  res.status(200).send(status)
})

app.get('/search/:words/:page?', (req,res) => {
  let words = req.params.words
  let page = req.params.page

  let url = `https://www.youtube.com/results?search_query=${encodeURIComponent(words)}&page=${page?page:1}`
  console.log(url)
  request.get(url,
  (err,response,body) => {
    if(err) {
      res.status(400).send({'status':'error',err})
    } else {
      const $ = cheerio.load(body)
      let result =$('ol.item-section > li')
        .map((i,el) => {
            let res = {
              url: 'https://youtube.com' + $(el).find('a').attr('href'),
              duration: $(el).find('span.video-time').text(),
              name: $(el).find('a[title]').first().text(),
            }
            let thumbnailEle = $(el).find('img').attr('data-thumb')
            if(!thumbnailEle)thumbnailEle = $(el).find('img').src
            res.thumbnail = thumbnailEle

            res.id = res.url.split('?v=')[1]
            return res
          })
        .toArray()
      return res.status(200).send(result)
    }
  })
})
kue.app.listen(3100,() => console.log('kue dashboard listening on port 3100'))
server.listen(3000,() => console.log('frontend listening on port 3000'))