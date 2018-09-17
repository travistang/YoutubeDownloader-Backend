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

const LaunchSubscriber = () => {
  const subscriber = redis.createClient({
    host: queueHost,
    port: amqpPort
  })
  subscriber.on('subscribe',(channel,count) => {
    // some debugging to make sure that we're indeed subscribing to the channel
  })
  subscriber.on('message',async (channel,message) => {
    // well redis gives a serialised thing, need to convert it back to an object
    // also redis is not just giving the "message" i sent back, instead its inside _docs...

    message = JSON.parse(message)
    console.log('received message on channel', channel,message)
    await Backend.updateTaskStatus(message.id,message)
    // TODO: websocket message dispatch!
    // TODO: launch download progress!
  })
  subscriber.subscribe(reportProgressChannel)
  return subscriber
}

module.exports = LaunchSubscriber
