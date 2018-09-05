/*
 * 	API usage:
 * 	- GET /storage/<audio_id>:
 * 		get the file downloaded
 * 	- 
 */
// file holding the implementation of endpoints

const express = require('express')
const cors = require('cors')
const app = express()
app.use(cors())
const server  = require('http').Server(app)

const cheerio = require('cheerio')
const request = require('request')
const ytdl = require('youtube-dl')
const axios = require('axios')
const DBAdapter = require('./db')
const socketHelper = require('./socket')

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

// serving static file - the downloaded videos
app.use('/storage',express.static('/storage'))
// kue queue query functions
const getJobStatusById = async (id) => {
  let resp = await axios.get(`${kueURL}/job/${id}`)
  return resp.data
}
// socket listeners
const socket = new socketHelper(server)

// TODO: check token collision
app.get('/audio/:id', async (req, res) => {
  let id = req.params.id
  let token = req.query.token

  // const db = new DBAdapter(mongoURL)
  if(!token) {
    res.status(400).send('missing token')
    return
  }
  if(id == 0) {
    res.status(400).send('missing ID')
    return
  }

  let existingTask = await db.getTaskById(id)
  if(existingTask && existingTask.status != 'failed') {
	// video started downloading, or queuing
    delete existingTask.token
  	return res.status(200).json(existingTask)
  } else {
    // create a new task
    // delete failed task first
    if(existingTask && existingTask.status == 'failed') {
      await db.deleteFailedTaskById(id)
    }

	  try {
	    ytdl.getInfo(id,async (err,info) => {
		if(err) {
		  res.status(400).send('invalid video ID')
		} else {

		    let job = queue.create('audio',{
		      id,
          name: info.title
		    })

		   // job entry creation
			// also delete the existing "failed" task
		    await db.createNewTask(job.id,
          token,id,
          info.title,
          `/storage/${encodeURIComponent(info.title)}.mp3`,
          info.thumbnail
        )

		    job.on('start',async () => {
		      await db.assignTaskIdByVideoId(id,job.id)
		      await db.updateTaskStatus(id,"started")
		      socket.emitJobStatus(token,"started",id)
		    })
		    job.on('failed',async () => {
		      socket.emitJobStatus(token,"failed",id)
		      await db.updateTaskStatus(id,'failed')
		    })
		    job.on('progress', async (progress) => {
		      socket.emitJobStatus(token,"progress",id,progress)
		      await db.updateTaskStatus(id,'progress')
		    })

		    job.on('complete',async () => {
	       socket.emitJobStatus(token,'completed',id)
		      // db.close()
		      await db.updateTaskStatus(id,"completed")
		    })
		    job.save(() => {
		      res.status(200).send({id:job.id})
		    })

		}
	      })
	  }catch(err) {
	    throw(err)
	    res.status(500).send('server error')
	  }
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

app.get('/name/:id',async (req,res) => {
  let videoId = req.params.id
  let result = await db.getVideoNameById(videoId)
  if(result) return res.status(200).json(result)
  else return res.status(404).json({error: "No records of this video id"})
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
      .filter(result => {
	// no playlist
	if(result.url.indexOf("list=") != -1) return false
	// with thumbnails only
	if(!result.thumbnail) return false
      	return true
      })
      return res.status(200).send(result)
    }
  })
})
kue.app.listen(3100,() => console.log('kue dashboard listening on port 3100'))
server.listen(3000,() => console.log('frontend listening on port 3000'))
