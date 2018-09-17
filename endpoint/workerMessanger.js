/*
  Class that deals with the dispatch and receipt of queuing commands
  Also defines the dispatch of progress to the same redis server
  When there are progress from the job,
  they will be broadcasted using channel "progress",
  with the following format:
  {
    ...task, // which consist of id,name,thumbnail...
    progress: {
      // type: one of ['started','failed','progress','complete']
      // percentage: exists only when type === 'progress'
    }
  }

*/

// the configs
const queueHost = 'localhost'
const amqpTopic = 'audio'
const amqpPort  = 6379
const reportProgressChannel = 'progress'

// data structure
// THIS IS FOLLOWING THE TYPE FROM KUE
const ProgressType = {
  pending: 'pending',
  start: 'start',
  failed: 'failed',
  progress: 'progress',
  complete: 'complete'
}
const kue = require('kue')
const queue = kue.createQueue(
  {
    prefix: 'q',
    redis: {
      port: amqpPort,
      host: queueHost,
    }
})

const redis = require('redis')
const publisher = redis.createClient({
  host: queueHost,
  port: amqpPort
})

class WorkerMessanger {
  static queueJob(task) {
    console.log('queuing job')
    let job = queue.create(amqpTopic,task)
    // create hooks for the job
    // iterate through the progress type, add hooks to the job
    Object.keys(ProgressType).forEach(type => {
      job.on(type,async (p) => {
        let payload = {
          ...task,
          status: type
        }
        console.log('payload',payload)
        if(type === ProgressType.progress) {
          console.log('adding progress',p)
          payload.progress = p
        }
        console.log('publishing payload',payload)
        publisher.publish(reportProgressChannel,JSON.stringify(payload))
      })
    })
    job.save()
    // but first, lets tell the world that this task is now in queue
    let queuePayload = {
      ...job.data,
    }
    publisher.publish(reportProgressChannel,JSON.stringify(queuePayload))
    return job
  }
}

module.exports = {
  queueHost,
  amqpTopic,
  amqpPort,reportProgressChannel,
  queue,
  publisher,
  ProgressType,
  WorkerMessanger
}
