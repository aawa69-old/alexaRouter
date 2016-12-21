exports.websockets = function() {
    
    const _ = require('lodash');
    const fs = require('fs');

    //-----------------------------------------------------------------------------
    // Authorisation constants
    //-----------------------------------------------------------------------------
    const CONFIG = require('./config/config.json');

    //-----------------------------------------------------------------------------
    // Create a Websocket instance on port 8080
    //-----------------------------------------------------------------------------
    var WebSocketServer = require('ws').Server;
    var wsServer = require('http').createServer();
    var wss = new WebSocketServer({
        server: wsServer
    });

    var express = require('express');
    var wsApp = express();
    var wsPort = _.get(CONFIG, ['websocket', 'port'], 8080);

    //-----------------------------------------------------------------------------
    // Create a Websocket instance on port 8080
    //-----------------------------------------------------------------------------
    //const WEBSOCKET_PORT = _.get(CONFIG, ['websocket', 'port'], 8080);

    //const WebSocketServer = require('ws').Server;
    //const wss = new WebSocketServer({
    //    port: WEBSOCKET_PORT
    //});

    var process = require('./process/main');

    //-----------------------------------------------------------------------------
    // Generate a websocket connection
    //-----------------------------------------------------------------------------
    wss.on('connection', function connection(ws) {

        console.log("** Websocket Server Connected **");

        ws.on('message', function incoming(payload) {

            console.log("*** Websocket Receiving Message ***");

            const formattedAudioStream = fs.createReadStream(__dirname + '/alexa.wav');
            process.post(ws, formattedAudioStream);
        });
    });

    // Websocket port listener
    wsServer.on('request', wsApp);
    wsServer.listen(wsPort, process.ENV_IP, function() {
        console.log('WS server listening on: ' + wsServer.address().address + '/' + wsServer.address().port);
    });
};
