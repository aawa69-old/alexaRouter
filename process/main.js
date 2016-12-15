
'use strict';
    
var _main = this;

//-----------------------------------------------------------------------------
// Method: Main
// Process the input text - call watson text-to-speech api and stream to file
//-----------------------------------------------------------------------------
exports.main = function(request, response) {

    var https = require('https');
    //var watson = require('../watson/textToSpeech');

    console.log('Body: ' + JSON.stringify(request.body));

    var reqBody = request.body;

    console.log('Resource: ' + reqBody.resource + ' - Event: ' + reqBody.event);

    // Webhook event set up for new messages, but check anyway
    if (!(reqBody.resource === "messages" && reqBody.event === "created")) {
        request.status(400).json('Not a new message');
    }

    console.log('BEGIN: https call to get message ...');

    // Retrieve the message id from the initiating webhook event
    var message = reqBody.data.id;
    console.log('Message id: ' + message);

    //  Options for the call to cisco message API
    var options = {
        host: 'api.ciscospark.com',
        path: '/v1/messages/' + message,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': '{your cisco bearer token}'
        }
    };

    // The initiating webhook event only passes the message id, not the actual message.
    // Call the Cisco message API to retrieve the actual message text
    var req = https.get(options, function(res) {
        var output = '';
        console.log('Host: ' + options.host + ' - Status: ' + res.statusCode);
        res.setEncoding('utf8');

        res.on('data', function(chunk) {
            output += chunk;
        });

        // On 'End' - Process the retrieved Spark message text
        res.on('end', function() {
            var msgObj = JSON.parse(output);
            console.log('Output: ' + msgObj.text);

            // Call Watson Speech-to-Text API to generate a WAV file
            _main.textToSpeech(msgObj.text);
            response.status(201).json("WAV file created ...");
        });
    });

    // On 'Error' - bug out
    req.on('error', function(err) {
        console.log('Https call failed: ' + err.message);
        request.status(400).json('GET Error: ' + err.message);
    });

    // On 'End' ...
    req.end(console.log('END: https call to get message ...'));
};

//-----------------------------------------------------------------------------
// Method: getMsgText
// Process the retrieve message text - determine it's for alexa and format
//-----------------------------------------------------------------------------
exports.getMsgText = function(text) {

    var alexaText = "";
    var newText = text.toLowerCase(text);
    var alexaIdx = newText.indexOf("alexa");

    console.log("GetMsgText: instance of 'alexa' - " + alexaIdx + " - Text: " + newText);

    // Determine if message for 'Alexa' - remove 'Alexa' invocation word
    alexaText = alexaIdx >= 0 ? newText.slice(alexaIdx + 6) : alexaIdx;
    alexaText = encodeURIComponent(alexaText.trim(alexaText));

    console.log("GetMsgText: converted text - " + alexaText);
    return alexaText;
};

//-----------------------------------------------------------------------------
// Method: textToSpeech
// Call the Watson Text-to-Speech service
//-----------------------------------------------------------------------------
exports.textToSpeech = function(text) {

    var msgText = _main.getMsgText(text);

    if (msgText) {
        var TextToSpeechV1 = require('watson-developer-cloud/text-to-speech/v1');
        var fs = require('fs');

        var text_to_speech = new TextToSpeechV1({
            username: '{username of your created service}',
            password: '{password of your created service}',
            headers: {
                'X-Watson-Learning-Opt-Out': 'true'
            }
        });

        var params = {
            text: msgText,
            voice: 'en-US_AllisonVoice',
            accept: 'audio/wav'
        };

        // Pipe the synthesized text to a file
        text_to_speech.synthesize(params).pipe(fs.createWriteStream('./alexa.wav'));
    }
};

//-----------------------------------------------------------------------------
// Method: alexaSpeechRecognizer
// Call the Alexa SpeechRecognizer interface
//-----------------------------------------------------------------------------
exports.alexaSpeechRecognizer = function() {

    const https = require('https');
    const fs = require('fs');
    const stream = require('stream');
    const streamToBuffer = require('stream-to-buffer');
    const SpawnStream = require('spawn-stream');
    const isStream = require('is-stream');
    const isBuffer = require('is-buffer');
    const request = require('request');
    const _ = require('lodash');
    const httpParser = require('http-message-parser');

    const AUTH_CONFIG = require('./config/auth.json');
    const AUTH_HOST = _.get(AUTH_CONFIG, 'host', 'localhost');
    const AUTH_PORT = _.get(AUTH_CONFIG, 'port', 3000);
    const PRODUCT_ID = _.get(AUTH_CONFIG, 'productId', 'product_id');
    const DEVICE_SERIAL_NUMBER = _.get(AUTH_CONFIG, 'deviceSerialNumber', 0);

    const TOKEN_JSON_FILE = __dirname + '/config/token.json';
    const DEVICE_SECRET = _.get(require('./config/deviceSecret.json'), 'deviceSecret');

    const CONFIG = require('./config/config.json');
    const WEBSOCKET_PORT = _.get(CONFIG, ['websocket', 'port'], 8080);

    // Turn off verification of certificates
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

    const WebSocketServer = require('ws').Server;
    const wss = new WebSocketServer({
        port: WEBSOCKET_PORT
    });

    const ERROR_CODES = {
        INVALID_TOKEN: 'com.amazon.alexahttpproxy.exceptions.InvalidAccessTokenException'
    };

    const app = require('express')();
    const http = require('http').Server(app);

    var TOKEN;

    function loadTokenFromFile() {
        fs.readFile(TOKEN_JSON_FILE, function(error, token) {
            if (error) {
                console.error(error);
            }
            else {
                TOKEN = JSON.parse(token).access;
            }
        });
    }

    function getNewToken() {
        const URL = 'https://' + AUTH_HOST + ':' + AUTH_PORT + '/device/accesstoken/' + PRODUCT_ID + '/' + DEVICE_SERIAL_NUMBER + '/' + DEVICE_SECRET;

        request({
            url: URL
        }, function(error, response, body) {
            if (error) {
                console.error(error);
            }

            if (body) {
                try {
                    body = JSON.parse(body);
                }
                catch (e) {

                }

                if (_.get(body, 'access')) {
                    fs.writeFile(TOKEN_JSON_FILE, JSON.stringify(body), function(error) {
                        if (error) {
                            console.error(error);
                        }
                        else {
                            console.log('new token saved.');
                            loadTokenFromFile();
                        }
                    });
                }
                else {
                    console.error('No access token retrieved');
                    console.error(body);
                }
            }
        });
    }

    loadTokenFromFile();

    wss.on('connection', function(ws) {
        ws.on('message', function(payload) {
            try {
                payload = JSON.parse(payload);
            }
            catch (e) {
                payload = {};
            }

            const audioBase64 = payload.data;
            var inputAudioStream = new stream.PassThrough();

            if (_.isString(audioBase64)) {
                console.log('Received audio');
                const inputAudioBuffer = new Buffer(audioBase64, 'base64');

                inputAudioStream.end(inputAudioBuffer);
            }
            else {
                inputAudioStream.end('');
            }

            const sox = SpawnStream('sox', ['-', '-r', '16000', '-e', 'signed', '-b', '16', 'input.wav']);

            inputAudioStream.pipe(sox);

            setTimeout(function() {
                const formattedAudioStream = fs.createReadStream(__dirname + '/input.wav');

                post(ws, formattedAudioStream);
            }, 500);
        });
    });

    app.get('/', function(req, res) {
        res.send('index');
    });

    const PORT = process.ENV_PORT || _.get(CONFIG, 'port', 9000);

    http.listen(PORT, function() {

    });

    function post(ws, audioBuffer) {
        const BOUNDARY = 'BLAH1234';
        const BOUNDARY_DASHES = '--';
        const NEWLINE = '\r\n';
        const METADATA_CONTENT_DISPOSITION = 'Content-Disposition: form-data; name="metadata"';
        const METADATA_CONTENT_TYPE = 'Content-Type: application/json; charset=UTF-8';
        const AUDIO_CONTENT_TYPE = 'Content-Type: audio/L16; rate=16000; channels=1';
        const AUDIO_CONTENT_DISPOSITION = 'Content-Disposition: form-data; name="audio"';

        const headers = {
            'Authorization': 'Bearer ' + TOKEN,
            'Content-Type': 'multipart/form-data; boundary=' + BOUNDARY
        };

        const metadata = {
            messageHeader: {},
            messageBody: {
                profile: 'alexa-close-talk',
                locale: 'en-us',
                'format': 'audio/L16; rate=16000; channels=1'
            }
        };

        const postDataStart = [
            NEWLINE, BOUNDARY_DASHES, BOUNDARY, NEWLINE, METADATA_CONTENT_DISPOSITION, NEWLINE, METADATA_CONTENT_TYPE,
            NEWLINE, NEWLINE, JSON.stringify(metadata), NEWLINE, BOUNDARY_DASHES, BOUNDARY, NEWLINE,
            AUDIO_CONTENT_DISPOSITION, NEWLINE, AUDIO_CONTENT_TYPE, NEWLINE, NEWLINE
        ].join('');

        const postDataEnd = [NEWLINE, BOUNDARY_DASHES, BOUNDARY, BOUNDARY_DASHES, NEWLINE].join('');

        const options = {
            hostname: 'access-alexa-na.amazon.com',
            port: 443,
            path: '/v1/avs/speechrecognizer/recognize',
            method: 'POST',
            headers: headers,
            encoding: 'binary'
        };

        const req = https.request(options, function(res) {
            streamToBuffer(res, function(err, buffer) {
                console.log('response', buffer.length);
                if (err) {
                    console.error('error', err);
                    return false;
                }

                var errorCode;

                try {
                    errorCode = JSON.parse(buffer.toString('utf8')).error.code;
                    console.log(errorCode);
                }
                catch (e) {

                }

                if (errorCode) {
                    if (errorCode === ERROR_CODES.INVALID_TOKEN) {
                        getNewToken();
                        return false;
                    }
                }

                const parsedMessage = httpParser(buffer);
                var multipart = parsedMessage.multipart;

                if (Array.isArray(multipart)) {
                    multipart.forEach(function(part) {
                        var headers = part.headers;
                        var bodyBuffer = part.body;
                        var contentType = _.get(headers, 'Content-Type');

                        if (bodyBuffer) {
                            if (contentType === 'audio/mpeg') {
                                ws.send(JSON.stringify({
                                    headers: headers
                                }));

                                const responseAudioStream = new stream.PassThrough();
                                responseAudioStream.end(bodyBuffer);
                                responseAudioStream.on('data', function(data) {
                                    ws.send(data, {
                                        binary: true
                                    });
                                });
                            }
                            else if (contentType === 'application/json') {
                                var body = JSON.parse(bodyBuffer.toString('utf8'));
                                var directives = _.get(body, ['messageBody', 'directives']);
                                var streamUrls = [];
                                if (directives) {
                                    body.messageBody.directives = directives.map(function(directive, i) {
                                        var audioItem = _.get(directive, ['payload', 'audioItem']);
                                        if (audioItem) {
                                            var streams = _.get(audioItem, 'streams');
                                            if (streams) {
                                                directive.payload.audioItem.streams = streams.map(function(stream, j) {
                                                    if (/^https?/.test(stream.streamUrl)) {
                                                        streamUrls.push({
                                                            propertyPath: ['messageBody', 'directives', i, 'payload', 'audioItem', 'streams', j],
                                                            url: stream.streamUrl
                                                        });
                                                    }
                                                    return stream;
                                                });
                                            }
                                        }
                                        return directive;
                                    });
                                }

                                var streamUrlsSize = _.size(streamUrls);
                                if (streamUrlsSize) {
                                    var completed = 0;
                                    streamUrls.forEach(function(stream) {
                                        var urls = [];
                                        request(stream.url, function(error, response, bodyResponse) {
                                            urls.push(bodyResponse);
                                            _.set(body, stream.propertyPath.concat('streamMp3Urls'), urls);
                                            if (++completed === streamUrlsSize) {
                                                send(new Buffer(JSON.stringify(body)));
                                            }
                                        });
                                    });
                                }
                                else {
                                    send(bodyBuffer);
                                }

                                function send(bodyBuffer) {
                                    ws.send(JSON.stringify({
                                        headers: headers,
                                        body: bodyBuffer.toString('utf8')
                                    }));
                                }
                            }
                        }
                    });
                }
            });

            req.on('error', function(e) {
                console.log('problem with request: ' + e.message);
            });
        });

        if (isStream(audioBuffer)) {
            streamToBuffer(audioBuffer, function(error, buffer) {
                if (error) {
                    console.error(error);
                    return false;
                }
                sendRequest(buffer);
            });
        }
        else if (isBuffer(audioBuffer)) {
            sendRequest(audioBuffer);
        }
        else {
            console.error('Audio buffer invalid');
        }

        function sendRequest(audBuffer) {
            req.write(postDataStart);
            req.write(audBuffer);
            req.write(postDataEnd);
            req.end();
        }
    }



};
// exports.alexaSpeechRecognizer = function(text) {
//
//     var options = {
//         url: 'https://access-alexa-na.amazon.com/v1/avs/speechrecognizer/recognize',
//         headers: {
//             'Content-Type': 'multipart/form-data',
//             'Transfer-Encoding': 'chunked'
//         },
//         formData: formData
//     };

//     var destination = fs.createWriteStream(path.join(__dirname, outputfile));
//     destination.on('finish', function(){
//         process.exit();
//     });

//     //request.debug = 1;
//     request.post(options, function optionalCallback(err, httpResponse, body) {
//             //console.log(httpResponse);
//             if (body.length < 100) {
//                 console.log(body);
//             }
//             console.log("\n\r----Processing Done to (" + outputfile + ")----");
//             if (loadingInt != null) clearInterval(loadingInt);

//             if (err) {
//                 return console.error('upload failed:', err);
//             }
//             //console.log('Upload successful!  Server responded with:', body);
//         }).auth(null, null, true, token)
//         .pipe(destination);
// };

//-----------------------------------------------------------------------------
// Test harness
//-----------------------------------------------------------------------------
exports.somethingElse = function(request, response) {
    console.log("something ...");
    response.status(201).json("Found Something Else ...");
};
