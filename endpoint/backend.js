/*
  Class containing methods that interacts with the database
*/
const mongoose = require('mongoose')
const ytdl = require('youtube-dl')
const Utils = require('./utils')
const {WorkerMessanger,ProgressType} = require('./workerMessanger')
const _ = require('lodash')

const StatusEnum = ProgressType // use the same type with the worker
const Task = mongoose.model('task',{
  id: String, // identify amonst the tasks themselves
  duration: String,
  status: {type: String, enum: Object.values(StatusEnum),required: true}, // the job status, one of 'completed, queuing,downloading,...'
  name: String, // the name of the Video
  thumbnail: String, // the path of thumbnail,
  progress: Number
})

const url = 'mongodb://mongo:27017/yt'
let ioInstance = null
let socket = null
class Backend {
  static connect() {
    mongoose.connect(url)
  }
  static async getAllAudios() {
    let audios = await Task.find({}).exec()
    return audios
  }
  static async getAudioInfo(id,res) {

    return Utils.RunFunctionWithError(async () => {
      let info = await new Promise((resolve,reject) => {
        if(id[0] == '-') id = `youtu.be/${id}` // this is to solve the error received when there is a hyphen at the beginning of the id...
        ytdl.getInfo(id, (err,info) => {
          if(err) reject(err)
          else resolve(info)
        })
      })

      let infoResult = {
        name: info.title,
        thumbnail: info.thumbnail,
        duration: info.duration,
        id
      }
      return infoResult
    },res)
  }

  static async getTaskById(id) {
    let task = await Task.findOne({id}).exec()
    return task
  }
  /*
    Function that creates a task and insert it to the database
  */
  static async createTask(info,res) {
    return Utils.RunFunctionWithError(
      async () => {
        const initialState = {
          ...info,
          status: StatusEnum.pending
        }
        // let randomToken = Utils.RandomToken()
        let task = new Task(initialState)
        // TODO: what if the db creates the job but the queue failed to execue?

        let result = await task.save()
        WorkerMessanger.queueJob(initialState,socket)
        return res.status(201).json(result)
      }
    ,res)
  }
  /*
    Function that gathers the info of an audio and creates a task accordingly

*/
  // do not catch here: let others do it...
  static async removeTask(id) {
    let result = await Task.findOneAndDelete({id}).exec()
    return result
  }

  static async addAudioToQueue(id,res) {
    return Utils.RunFunctionWithError(
      async () => {
        // first check if the audio is in the queue already...
        let taskStatus = await Backend.getTaskById(id)
        if(taskStatus && taskStatus.status !== StatusEnum.failed) {
          console.log(`task for ${id} already added`)
          return res.status(200).json(taskStatus) // task is there and no error, so just wait...
        } else if(taskStatus) {
          // task is there but there are also errors...
          // delete the existing record first, then add it back
          await Backend.removeTask(id)
        }
        let info = await Backend.getAudioInfo(id)
        return await Backend.createTask(info,res)
      }
    ,res)
  }
  static async updateTaskStatus(taskId,taskStatus) {
    let payload = _.pick(taskStatus,[
      'id',
      'status',
      'name',
      'thumbnail',
      'duration',
      'progress'
    ])
    await Task
      .findOneAndUpdate({id: taskId},payload)
      .exec()
  }
}

module.exports = Backend
