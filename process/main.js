'use strict';

var _main = this;

const https = require('https');
const fs = require('fs');
const stream = require('stream');
const streamToBuffer = require('stream-to-buffer');
const isStream = require('is-stream');
const isBuffer = require('is-buffer');
const request = require('request');
const _ = require('lodash');
const httpParser = require('http-message-parser');

const TMP = require('../tmp/test.json');

//-----------------------------------------------------------------------------
// Method: Main
// Process the input text - call watson text-to-speech api and stream to file
//-----------------------------------------------------------------------------
exports.main = function(request, response) {

    var https = require('https');

    console.log('Body: ' + JSON.stringify(request.body));

    var reqBody = request.body;

    console.log('Resource: ' + reqBody.resource + ' - Event: ' + reqBody.event);

    // Webhook event set up for new messages, but check anyway
    if (!(reqBody.resource === "messages" && reqBody.event === "created")) {
        response.status(400).json('Not a new message');
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
            'Authorization': _.get(TMP, 'spark', "no token")
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
            //response.send("WAV file created ...");
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

        var text_to_speech = new TextToSpeechV1({
            username: _.get(TMP, 'bmuser'),  //'{username of your created service}',
            password: _.get(TMP, 'bmpw'),  //'{password of your created service}',
            headers: {
                'X-Watson-Learning-Opt-Out': 'true'
            }
        });

        var params = {
            text: msgText,
            voice: 'en-US_AllisonVoice',
            accept: 'audio/l16;rate=16000'
        };

        // Pipe the synthesized text to a file
        text_to_speech.synthesize(params).pipe(fs.createWriteStream('./alexa.wav'));
    }
};

//-----------------------------------------------------------------------------
// Method: alexaSpeechRecognizer
// Call the Alexa SpeechRecognizer interface
//-----------------------------------------------------------------------------
exports.loadTokenFromFile = function() {

    const TOKEN_JSON_FILE = '../config/token.json';

    fs.readFile(TOKEN_JSON_FILE, function(error, token) {
        if (error) {
            console.error(error);
        }
        else {
            return JSON.parse(token).access;
        }
    });
};

//-----------------------------------------------------------------------------
// Method: postToWS
// Call the Websocket
//-----------------------------------------------------------------------------
exports.postToWS = function(ws, audioBuffer) {

    if (isStream(audioBuffer)) {
        console.log("isStream(audioBuffer) = true");
        
        streamToBuffer(audioBuffer, function(error, buffer) {
            if (error) {
                console.error(error);
                return false;
            }
            console.log("METHOD: _main.sendRequest(buffer)");
            _main.sendRequest(ws, buffer);
        });
    }
    else if (isBuffer(audioBuffer)) {
        console.log("isBuffer(audioBuffer) = true");
        console.log("METHOD: _main.sendRequest(audioBuffer)");
        _main.sendRequest(ws, audioBuffer);
    }
    else {
        console.error('Audio buffer invalid');
    }
};

//-----------------------------------------------------------------------------
// Process message payload
//-----------------------------------------------------------------------------
_main.handleMsgBody = function(ws, part) {

    var headers = part.headers;
    var contentType = _.get(headers, 'Content-Type'); // Get Content-Type from the header
    var bodyBuffer = part.body;

    console.log("Content-Type: " + contentType);    

    switch (contentType) {
        case 'audio/mpeg':
            console.log(" - audio/mpeg: ws.send(headers)");
            console.log(" - header: " + JSON.stringify({ headers: headers }));    
            
            ws.send(JSON.stringify({
                headers: headers
            }));

            const responseAudioStream = new stream.PassThrough();

            responseAudioStream.end(bodyBuffer);
            responseAudioStream.on('data', function(data) {
                console.log(" - responseAudioStream.on: data -> ws.send(data)");    
                
                ws.send(data, {
                    binary: true
                });
            });

        case 'application/json':
            
            console.log(" - application/json");

            var body = JSON.parse(bodyBuffer.toString('utf8'));
            var directives = _.get(body, ['messageBody', 'directives']);
            var streamUrls = [];

            if (directives) {
                console.log(" - directives: " + JSON.stringify({ directives }));
                
                body.messageBody.directives = directives.map(function(directive, i) {
                    
                    var audioItem = _.get(directive, ['payload', 'audioItem']);
                    console.log(" - audioItem: " + JSON.stringify({ audioItem }));
                    
                    if (audioItem) {
                        var streams = _.get(audioItem, 'streams');
                        console.log(" - streams: " + JSON.stringify({ streams }));
                        
                        if (streams) {
                            directive.payload.audioItem.streams = streams.map(function(stream, j) {
                                if (/^https?/.test(stream.streamUrl)) {
                                    streamUrls.push({
                                        propertyPath: ['messageBody', 'directives', i, 'payload', 'audioItem', 'streams', j],
                                        url: stream.streamUrl
                                    });
                                }
                                
                                console.log(" - return stream: " + JSON.stringify({ stream }));
                                return stream;
                            });
                        }
                    }
                    console.log(" - return directive: " + JSON.stringify({ directive }));
                    return directive;
                });
            }

            var streamUrlsSize = _.size(streamUrls);
            console.log(" - streamUrlsSize: " + streamUrlsSize);
            
            if (streamUrlsSize) {
                var completed = 0;
                
                streamUrls.forEach(function(stream) {
                    var urls = [];
                    
                    console.log(" - request(stream.url ... : " + stream.url);
                    request(stream.url, function(error, response, bodyResponse) {
                        
                        urls.push(bodyResponse);
                        console.log(" - urls.push(bodyResponse): " + JSON.stringify({ bodyResponse }));
                        _.set(body, stream.propertyPath.concat('streamMp3Urls'), urls);
                        
                        if (++completed === streamUrlsSize) {
                            console.log(" - call to: _main.send(headers, new Buffer(JSON.stringify(body)), ws);");
                            console.log(" - body: " + JSON.stringify({ body }));
                            _main.send(headers, new Buffer(JSON.stringify(body)), ws);
                        }
                    });
                });
            }
            else {
                console.log(" - call to: _main.send(headers, bodyBuffer, ws);");
                console.log(" - bodyBuffer: " + JSON.stringify({ bodyBuffer }));
                _main.send(headers, bodyBuffer, ws);
            }
    }
};

//-----------------------------------------------------------------------------
// Send to the Websocket
//-----------------------------------------------------------------------------
exports.send = function(headers, bodyBuffer, ws) {

    ws.send(JSON.stringify({
        headers: headers,
        body: bodyBuffer.toString('utf8')
    }));
};

//-----------------------------------------------------------------------------
// Send the request
//-----------------------------------------------------------------------------
exports.sendRequest = function(ws, audBuffer) {

    const BOUNDARY = 'BLAH1234';
    const BOUNDARY_DASHES = '--';
    const NEWLINE = '\r\n';
    const METADATA_CONTENT_DISPOSITION = 'Content-Disposition: form-data; name="metadata"';
    const METADATA_CONTENT_TYPE = 'Content-Type: application/json; charset=UTF-8';
    const AUDIO_CONTENT_TYPE = 'Content-Type: audio/L16; rate=16000; channels=1';
    const AUDIO_CONTENT_DISPOSITION = 'Content-Disposition: form-data; name="audio"';

    var TOKEN = _main.loadTokenFromFile(); // Load the token

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

    const postDataEnd = [
        NEWLINE, BOUNDARY_DASHES, BOUNDARY, BOUNDARY_DASHES, NEWLINE
    ].join('');

    const options = {
        hostname: 'access-alexa-na.amazon.com',
        port: 443,
        path: '/v1/avs/speechrecognizer/recognize',
        method: 'POST',
        headers: headers,
        encoding: 'binary'
    };

    console.log("---------------------------");   
    console.log("BEGIN: postToWS");    

    const req = https.request(options, function(res) {

        streamToBuffer(res, function(err, buffer) {

            console.log('response', buffer.length);

            if (err) {
                console.error('streamToBuffer: Error', err);
                return false;
            }

            var errorCode;

            try {
                errorCode = JSON.parse(buffer.toString('utf8')).error.code;
                console.log("errorCode = JSON.parse(buffer.toString('utf8')).error.code;" + errorCode);
            }
            catch (e) {

            }

            if (errorCode) {
                console.log("errorCode found: exiting");
                return false;
            }

            const parsedMessage = httpParser(buffer);
            var multipart = parsedMessage.multipart;

            if (Array.isArray(multipart)) {
                console.log("Is Multipart: multipart - " + multipart);    
                
                multipart.forEach(function(part) {

                    console.log("part.body: " + part.body);   

                    // Message has no payload
                    var bodyBuffer = part.body;
                    if (!bodyBuffer) { 
                        return;
                    }

                    // Process the message payload
                    console.log(" METHOD: _main.handleMsgBody(ws, part)");   
                    _main.handleMsgBody(ws, part); 
                });
            }
        });

        req.on('error', function(e) {
            console.log("req.on 'error': problem with request - " + e.message);
        });
    });

    console.log("- BEGIN: sendRequest");
    console.log("- postDataStart: " + JSON.stringify(postDataStart));
    console.log("- audBuffer: " + JSON.stringify(audBuffer));
    console.log("- postDataEnd:   " + JSON.stringify(postDataEnd));
    console.log("- END: sendRequest");

    //req.write(postDataStart);
    //req.write(audBuffer);
    //req.write(postDataEnd);
    req.end();
};

//-----------------------------------------------------------------------------
// Test harness
//-----------------------------------------------------------------------------
exports.somethingElse = function(request, response) {
    console.log("something ...");
    response.status(201).json("Found Something Else ...");
};
