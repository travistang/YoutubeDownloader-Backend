const mongoose = require('mongoose')
// const Audio = mongoose.model('audio',{
//   name: String,
//   path: String,
//   videoId: String
// })
const Task = mongoose.model('task',{
  id: String, // identify amonst the tasks themselves
  token: String, // identify the task submitter
  status: String, // the job status, one of 'completed, queuing,downloading,...'
  name: String, // the name of the Video
  thumbnail: String, // the path of thumbnail
})

module.exports = class DBAdapter {
  constructor(url) {
    this.url = url
    mongoose.connect(url)
  }
  async updateTaskStatus(id,status) {
    return await Task.findOneAndUpdate({videoId: id},{status: status}).exec()
  }
  close() {
    mongoose.disconnect()
  }
  async getTaskById(id) {
    let task = await Task.findOne({videoId:id}).exec()
    return task
  }
  async assignTaskIdByVideoId(videoId,taskId) {
    return await Task.findOneAndUpdate({videoId},{id:taskId}).exec()
  }
  async createNewTask(id,token,videoId,name,path,thumbnail = null) {
    let taskDoc = new Task({
      id,
      status: 'queuing',
      token,
      videoId,
      name,
      path,
      thumbnail
    })
    return await taskDoc.save()
  }
  async getVideoNameById(videoId) {
    return await Task.findOne({videoId},'name').exec()
  }
  async deleteFailedTaskById(videoId) {
  	return await Task.findOneAndRemove({videoId,status: 'failed'}).exec()
  }

}
