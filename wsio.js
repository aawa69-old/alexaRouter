var express = require('express');
var app = express();

var server = require('http').createServer(app);
var io = require('socket.io')(server);

io.on('connection', function(client) {
	// 2. Websocket listening to same port - connects
	//	  emits message - listener in html file fires an 'alert' message
    console.log('Websocket client connected');
    //console.log('world');
    //client.emit('messages', {hello: 'world'});		// emit the messages event on the client (in this case our browser)

    client.on('messages', function(data) {
		// 3. Listen for events coming back in from the browser
    	console.log(data);
    });
});

// 1. 'http://localhost:8080' called from browser - responds with the html file
app.get('/', function(req, res) {
	console.log(req.method + ' sent to ' + req.url);
	
	var socketio = require('socket.io-client');
	var socket = socketio.connect('http://localhost:8080');
	socket.emit('messages', "yo dude");
 });

server.listen(8080);