/*
  file declaring endpoints
*/
const PORT = 3005
const express = require('express')
// const cors = require('cors')
const app = express()
const server = require('http').Server(app)
const Utils = require('./utils')
const Backend = require('./backend')
const request = require('request')
const cheerio = require('cheerio')
const kue     = require('kue')
const {queue} = require('./workerMessanger')
const io = require('socket.io')(server)
const LaunchSubscriber = require('./progressUpdater')
// initialize stuff
Backend.connect()



// serving static file - the downloaded videos
app.use('/storage',express.static('/storage'))

app.get('/audio', async (req,res) => {
  let audios = await Backend.getAllAudios()
  return res.status(200).json(audios)
})
/*
  given the ID of an audio (in youtube's format),
  give the status of the video
*/
app.get('/audio/:id', async (req,res) => {
  let id  = req.params.id
  let taskDoc = await Backend.getTaskById(id)
  return res.status(200).json(taskDoc)
})
/*
  given the ID of an audio (in youtube's format)
  create a task to download this audio.
*/
app.post('/audio/:id',async (req,res) => {
  let id = req.params.id
  return await Backend.addAudioToQueue(id,res)
})

app.get('/search/:words/:page?', (req,res) => {
  let words = req.params.words
  let page = req.params.page

  let url = `https://www.youtube.com/results?search_query=${encodeURIComponent(words)}&page=${page?page:1}`
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
       .filter(result => {
         // no playlist
        if(result.url.indexOf("list=") != -1) return false
        if(!result.id) return false // no private videos(?)
        // with thumbnails only
        return true
      })

      return res.status(200).send(result)
    }
  })
})

kue.app.listen(3100,() => console.log('kue dashboard listening on port 3100'))
server.listen(PORT,() => console.log(`api listening on ${PORT}`))
const subscriber = LaunchSubscriber(io)
