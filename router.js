'use strict';

const fs = require('fs');
const _ = require('lodash');
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
// Create a Websocket instance on port 8080
//-----------------------------------------------------------------------------
const WEBSOCKET_PORT = _.get(CONFIG, ['websocket', 'port'], 8080);

const WebSocketServer = require('ws').Server;
const wss = new WebSocketServer({
    port: WEBSOCKET_PORT
});

//-----------------------------------------------------------------------------
// HTTP Server details
//-----------------------------------------------------------------------------
const app = require('express')();
const http = require('http').Server(app);

var process = require('./process/main');

app.use(bodyParser.json());

// Routers
app.post('/', function(request, response) {
    process.main(request, response);
});

app.get('/', function(req, res) {
    res.send('index');
});

app.get('/test', function(req, res) {
    process.somethingElse(req,res);
});

// Port listener
const PORT = _.get(process.ENV_PORT || CONFIG, 'port', 8081);   // process.ENV_PORT || _.get(CONFIG, 'port', 9000);
app.listen(PORT, process.ENV_IP, function() {
    console.log('Listening on port ' + PORT);
});

//-----------------------------------------------------------------------------
// Generate a websocket connection
//-----------------------------------------------------------------------------
wss.on('connection', function(ws) {
    
    console.log("** Websocket Server Connected **");
    
    ws.on('message', function(payload) {
        
        console.log("*** Websocket Receiving Message ***");
        
        const formattedAudioStream = fs.createReadStream(__dirname + '/alexa.wav');
        process.post(ws, formattedAudioStream);

    });
});
