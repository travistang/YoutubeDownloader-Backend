// testing the functionality
/*
  Dependencies:
    - socket.io-client
    - request
    - request-promise
*/
const apiURL = 'http://localhost:3005'
const request = require('request-promise')
const _ = require('lodash')
const searchKeyword = "Beethoven"
let vidId = "B7bqAsxee4I"// a video id we get from search
// 1. the user search something according to keyword...
console.log('searching for word',searchKeyword)
request({
  uri:`${apiURL}/search/${searchKeyword}`,
  json: true
})
  .then(result => {
    // say we want the second result
    // vidId = _.sample(result).id
    console.log('downloading video with id',vidId)
    // 2. lets submit the task for downloading this audio
    const uri = `${apiURL}/audio/${vidId}`
    return request.post({
      uri,
      json: true
    })
  })
  .then(task => {
    // 3. now that we have the task, lets use a websocket to monitor its progress...
    const socket = require('socket.io-client')(apiURL)
    console.log('socket created')
    socket.on('connect',() => {
      console.log('socket connected')
    })
    socket.on(vidId,(data) =>{
      console.log('download progress:',data)
    })
  })
