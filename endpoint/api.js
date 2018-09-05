/*
  file declaring endpoints
*/
const express = require('express')
// const cors = require('cors')
const app = express()
const server = require('http').Server(app)
const Utils = require('./utils')
const Backend = require('./backend')
const LaunchSubscriber = require('./progressUpdater')
// initialize stuff
Backend.connect()
LaunchSubscriber()

// serving static file - the downloaded videos
app.use('/storage',express.static('/storage'))

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
  let taskDoc = await Backend.getTaskById(id)
  if(taskDoc) return res.status(200).json(taskDoc)
  else {
    return await Backend.addAudioToQueue(id,res)
  }
})

app.listen(3000,() => console.log('api listening on 3000'))
