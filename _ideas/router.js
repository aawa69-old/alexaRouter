'use strict';

const _ = require('lodash');
const fs = require('fs');
const bodyParser = require('body-parser'); // form data parsing - npm install body-parser

//-----------------------------------------------------------------------------
// Authorisation constants
//-----------------------------------------------------------------------------
const AUTH_CONFIG = require('./config/auth.json');
const AUTH_HOST = _.get(AUTH_CONFIG, 'host', 'localhost');
const AUTH_PORT = _.get(AUTH_CONFIG, 'port', 3000);
const PRODUCT_ID = _.get(AUTH_CONFIG, 'productId', 'product_id');
const DEVICE_SERIAL_NUMBER = _.get(AUTH_CONFIG, 'deviceSerialNumber', 0);

const DEVICE_SECRET = _.get(require('./config/deviceSecret.json'), 'deviceSecret');

const CONFIG = require('./config/config.json');

//-----------------------------------------------------------------------------
// HTTP Server details
//-----------------------------------------------------------------------------
var express = require("express");
var app = express();

var server = require('http').createServer(app);

//var wss = require('./process/websocket');

var io = require('socket.io')(server);
var ioClient = require('socket.io-client');

var port = _.get(CONFIG, 'port', 8081); // _.get(process.ENV_PORT || CONFIG, 'port', 8081);     

//-----------------------------------------------------------------------------
// Create a Websocket instance on port 8080
//-----------------------------------------------------------------------------
//const WEBSOCKET_PORT = _.get(CONFIG, ['websocket', 'port'], 8080);

//const WebSocketServer = require('ws').Server;
//const wss = new WebSocketServer({
//    port: WEBSOCKET_PORT
//});

//-----------------------------------------------------------------------------
// Routes
//-----------------------------------------------------------------------------
var process = require('./process/main');

app.use(bodyParser.json());

// Routers
//app.post('/', function(request, response) {
//    process.main(request, response);
//response.send("WAV file created ...");
//});

app.post('/', function(request, response) {
    process.main(request, response);

    //var ioClient = require('socket.io-client');
    //var clientWS = ioClient.connect('http://localhost:8081');
    //clientWS.emit('messages', "process file ...");
});

app.get('/', function(req, res) {
    res.send('index');
});

app.get('/test', function(req, res) {
    process.somethingElse(req, res);
});

//-----------------------------------------------------------------------------
// Generate a websocket connection
//-----------------------------------------------------------------------------
io.on('connection', function(ws) {

    console.log("** Websocket Server Connected **");

    ws.on('messages', function(data) {

        console.log("*** Websocket Receiving Message ***");

        const formattedAudioStream = fs.createReadStream(__dirname + '/alexa.wav');
        process.postToWS(ws, formattedAudioStream);
    });
});

// Port listener
//server.on('request', app);
server.listen(port, function() { //server.listen(port, process.ENV_IP, function() {
    console.log('HTTP listening on: ' + server.address().address + '/' + server.address().port);
});
