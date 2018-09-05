// script for testing out the functionality of the backend
var socket = require('socket.io-client')('http://localhost:3000');
const request = require('request')
socket.on('connect', () => {
  console.log('connect')
  request.get('http://localhost:3000/audio/M0e-uNfN2oM?token=123',(err,res,body) => {
  })
});
let token = '123'
socket.on(token,payload => {
  console.log(JSON.stringify(payload))
})
socket.on('disconnect', () => console.log('disconnect'));
