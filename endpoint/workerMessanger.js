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
const queueHost = '127.0.0.1'
const amqpTopic = 'audio'
const amqpPort  = 6379
const reportProgressChannel = 'progress'

// data structure
const ProgressType = {
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
    let job = queue.create(amqpTopic,task)
    // create hooks for the job
    // iterate through the progress type, add hooks to the job
    Object.keys(ProgressType).forEach(type => {
      job.on(type,async (p) => {
        let payload = {
          ...task,
          progress: {
            type
          }
        }
        if(type === ProgressType.progress) {
          payload.progress.percentage = p
        }
        publisher.publish(reportProgressChannel,JSON.stringify(payload))
      })
    })
    // but first, lets tell the world that this task is now in queue
    let queuePayload = {
      ...task,
      progress: {
        type: 'queue'
      }
    }
    publisher.publish(reportProgressChannel,JSON.stringify(queuePayload))
    return job
  }
}

module.exports = {
  queueHost,
  amqpTopic,
  amqpPort,reportProgressChannel,
  WorkerMessanger
}
