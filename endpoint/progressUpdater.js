/*
  defines a subscriber that subscribes all the progress events from the workers,
  and write the changes to database accordingly
  also create a socket that dispatch events to whoever listens to it
*/
const redis = require('redis')
const Backend = require('./backend')
const {
  queueHost,amqpTopic,amqpPort,reportProgressChannel,
  WorkerMessanger
} = require('./workerMessanger')

const LaunchSubscriber = (io) => {
  // setting up the socket
  let socket
  console.log('subscribing console')
  io.on('connection',(sock) => {
    console.log('received socket io connection')
    socket = sock
    sock.on('create', async (vidId) => { // when new client come and request the info of video id
      // each "room" has a name of the 'video' id
      let audio = await Backend.getTaskById(vidId)
      if(!audio) return // no such task on record...
      socket.emit(vidId,audio) // gives the last known info to the client

    })
  })

  const subscriber = redis.createClient({
    host: queueHost,
    port: amqpPort
  })
  subscriber.on('subscribe',(channel,count) => {
    // some debugging to make sure that we're indeed subscribing to the channel
    console.log('subscribed to amqp')
  })
  subscriber.on('message',async (channel,message) => {
    // well redis gives a serialised thing, need to convert it back to an object
    // also redis is not just giving the "message" i sent back, instead its inside _docs...
    message = JSON.parse(message)
    await Backend.updateTaskStatus(message.id,message)
    // TODO: websocket message dispatch!
    // TODO: launch download progress!
    if(socket) {
      console.log('emitting to socket',message.id)
      socket.emit(message.id,message)
      if(message.progress && (message.progress == 100 || message.status == 'error')) {
        // close the connection when it should be terminated...
        socket.disconnect(0)
        socket = null
      }
    }


  })
  subscriber.subscribe(reportProgressChannel)
  return subscriber
}

module.exports = LaunchSubscriber
