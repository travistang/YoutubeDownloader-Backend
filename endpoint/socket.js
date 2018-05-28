const socketio = require('socket.io')

module.exports = class {
	constructor(server) {
		this.io = socketio(server)
		this.socket = null
		this.io.on('connection', s => {
			this.socket = s
		})
	}
	
	emitJobStatus(token,type,id,progress = null) {
		if(!this.socket)return
		this.socket.emit(token,{
			type,id,progress
		})
	}
}
