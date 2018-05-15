const express = require('express')
const app = express()
const server  = require('http').Server(app)
const io      = require('socket.io')(server)

const cheerio = require('cheerio')
const request = require('request')
const ytdl = require('youtube-dl')
const fs = require('fs')
const DBAdapter = require('./db')
// connect to MongoDB
let db = new DBAdapter('mongodb://localhost:60717/yt')
// const Audio = mongoose.model('audio',{
//   name: String,
//   path: String,
//   videoId: String
// })
// const Task = mongoose.model('task',{
//   id: String,
//   token: String,
//   status: String,
//   videoId: String,
// })

// connect to kue/redis
var kue = require('kue')
 , queue = kue.createQueue({
   prefix: 'q',
   redis: {
     port: 6379,
     host: 'localhost',
   }
 });

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


  if(!token) {
    res.status(400).send('missing token')
    return
  }
  if(!socket) {
    res.status(500).send('server not ready')
  }
  if(id == 0) {
    res.status(400).send('missing ID')
  }

// TODO: determine the path of downloading file here
  try {
    ytdl.getInfo(id,async (err,info) => {
        if(err) {
          res.status(400).send('invalid video ID')
        } else {
          let audioObj = await db.getAudioById(id)
          if(audioObj != 0) {
            res.status(200).send({
              path: audioObj.path
            })
          } else {
            console.log('download audio')

            let job = queue.create('audio',{
              id
            })

            await db.createNewTask(job.id,token,id)

            job.on('start',async () => {
              console.log('job started')
              try {
                await db.updateTaskStatus(id,"started")
                // await Task.findOneAndUpdate({videoId: id},{status: 'started'}).exec()
              }catch(e) {
                console.log(e)
                res.status(500).send('failed to connect to database')
              }
              await db.createNewAudio(info.title,id,`/audio/${id}.mp3`)
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
app.get('/status/:jobid',(req,res) => {
  let token = req.query.token
  if(!token) return

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
server.listen(3000,() => console.log('frontend listening on port 3000'))
