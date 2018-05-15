const mongoose = require('mongoose')
const Audio = mongoose.model('audio',{
  name: String,
  path: String,
  videoId: String
})
const Task = mongoose.model('task',{
  id: String,
  token: String,
  status: String,
  videoId: String,
})

module.exports = class DBAdapter {
  constructor(url) {
    this.url = url
    mongoose.connect(url)
  }
  async updateTaskStatus(id,status) {
    return await Task.findOneAndUpdate({videoId: id},{status: status}).exec()
  }
  async getAudioById(id) {
    return await Audio.find({videoId: id}).exec()
  }
  async getTaskById(id) {
    let task = await Task.findOne({id}).exec()
    console.log('get task by id')
    console.log(task)
    return task
  }
  async assignTaskIdByVideoId(videoId,taskId) {
    return await Task.findOneAndUpdate({videoId},{id:taskId}).exec()
  }
  async createNewTask(id,token,videoId) {
    let taskDoc = new Task({
      id,
      status: 'queuing',
      token,
      videoId
    })
    return await taskDoc.save()
  }


  async createNewAudio(name,videoId,path) {
    let audioDoc = new Audio({name,videoId,path})
    return await audioDoc.save()
  }

}
