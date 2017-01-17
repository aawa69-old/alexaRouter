'use strict';

var _main = this;

const http = require('http');
const fs = require('fs');
const stream = require('stream');
const streamToBuffer = require('stream-to-buffer');
const isStream = require('is-stream');
const isBuffer = require('is-buffer');
const request = require('request');
const _ = require('lodash');
const httpParser = require('http-message-parser');
const Buffer = require('buffer').Buffer;
const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
var toArrayBuffer = require('to-arraybuffer');

const arrayBufferToString = require('./arrayBufferToString.js');
const AMAZON_ERROR_CODES = require('./AmazonErrorCodes.js');

const TMP = require('../tmp/test.json');

const TOKEN_JSON_FILE = __dirname + '/token.json';
var TOKEN = "Atza|IwEBIG2SH07us3T1ZDzImX9-Vi3nhTMuKAqf7YgU9ueVpDBTe9I-lAXm0bBiLpScunu0xsSd_nz2Ztj90wemSUCMA25UBzfrb6NFZrZ501h8mUU1zWqcDMC9f-QP9DGiIMIWTfC-Kn7_y4rqn7TEIbMJaigVL9yJXyJJ-SoT7S_2LmKzPFxFDc7fYgyYW9Sl0GgX2ngKZPjHMLBPHEr4iylUQU9jBaSqPaz3P79D7W1Ypm-TdyOar6k2ke1XogQUmi5bSyLHr2M1NARpjlgPPfXIIvQaECizNpMSLJpM0uCxkYexx6KVEMKDcniTLiCxK1GF-DvbfO6KLAfHchyc5wigws8StJzCMGwog2pMutZM88GHqEYSIKXEAOkM5dunomTSU-Mj1beEjvsKGAEdVxJhoKSn4wfH8CHjUkf8SrBZ1aZFBXdNuYGbZvK1Q8psSaxQ9spkwWdf2TJlVcSX3gFgdOv-FbgJRy4cRynQ-ZdHV-l2eLEGawhEL6tlTleuuKroKF0pn69VNyrAKxDjX9TLbZwX";

//-----------------------------------------------------------------------------
// Method: Main
// Process the input text - call watson text-to-speech api and stream to file
//-----------------------------------------------------------------------------
exports.main = function(request, response) {

    TOKEN = _main.loadTokenFromFile(); // TEMPORARY - Load the token from static file 

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
    var fileLen = 0;

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
            fileLen = _main.textToSpeech(msgObj.text);
        });
    });

    // On 'Error' - bug out
    req.on('error', function(err) {
        console.log('Https call failed: ' + err.message);
        response.status(400).json('GET Error: ' + err.message);
    });

    // On 'End' ...
    req.on('end', function() {
        console.log('END: https call to get message ...');
    });
};

//-----------------------------------------------------------------------------
// Method: getMsgText
// Process the retrieve message text - determine it's for alexa and format
//-----------------------------------------------------------------------------
exports.getMsgText = function(text) {

    var alexaText = "";
    var newText = text.toLowerCase(text);
    var alexaIdx = newText.indexOf("alexa");

    console.log("METHOD: getMsgText: instance of 'alexa' - " + alexaIdx + " - Text: " + newText);

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
            username: _.get(TMP, 'bmuser'), //'{username of your created service}',
            password: _.get(TMP, 'bmpw'), //'{password of your created service}',
            headers: {
                'X-Watson-Learning-Opt-Out': 'true'
            }
        });

        var params = {
            text: msgText,
            voice: 'en-US_AllisonVoice',
            accept: 'audio/wav' //'audio/l16;rate=16000'
        };

        // Pipe the synthesized text to a file
        //text_to_speech.synthesize(params).pipe(fs.createWriteStream('./alexa.wav'));

        _main.sendAudio()
            .then((xhr, response) => {

                var promises = [];
                var audioMap = {};
                var directives = null;

            })
            .catch(error => {
                console.error(error);
            });

        var fileLen = _main.getFilesizeInBytes();
        console.log("METHOD: textToSpeech: alexa.wav length - " + fileLen);
        return fileLen;
    }
};

exports.getFilesizeInBytes = function() {

    var stats = fs.statSync('./alexa.wav');
    var fileSizeInBytes = stats["size"];
    return fileSizeInBytes;

};

//-----------------------------------------------------------------------------
// Method: alexaSpeechRecognizer
// Call the Alexa SpeechRecognizer interface
//-----------------------------------------------------------------------------
exports.loadTokenFromFile = function() {

    fs.readFile(TOKEN_JSON_FILE, function(error, token) {
        if (error) {
            console.error(error);
        }
        else {
            var parsed = JSON.parse(token).access;
            console.log("METHOD loadTokenFrom File: token: " + parsed);
            return parsed;
        }
    });
};

//-----------------------------------------------------------------------------
// Method: sendAudio
// Call AVS
//-----------------------------------------------------------------------------
exports.sendAudio = function(file) {

    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const url = 'https://access-alexa-na.amazon.com/v1/avs/speechrecognizer/recognize';

        console.log(audio.sampleRate);

        if (audio.channelData[0]) {
            console.log('Channel 0 length: ' + audio.channelData[0].length);
        } // Float32Array 
        if (audio.channelData[1]) {
            console.log('Channel 1 length: ' + audio.channelData[1].length);
        } // Float32Array 

        xhr.open('POST', url, true);
        xhr.responseType = 'arraybuffer';

        xhr.onload = (event) => {
            const buffer = new Buffer(xhr.response);

            if (xhr.status === 200) {
                const parsedMessage = httpParser(buffer);
                resolve(xhr, parsedMessage);
            }
            else {
                let error = new Error('An error occured with request.');
                let response = {};

                if (!xhr.response.byteLength) {
                    error = new Error('Empty response.');
                }
                else {
                    try {
                        response = JSON.parse(arrayBufferToString(buffer));
                    }
                    catch (err) {
                        error = err;
                    }
                }

                if (response.error instanceof Object) {
                    if (response.error.code === AMAZON_ERROR_CODES.InvalidAccessTokenException) {
                        console.log("METHOD sendAudio: Invalid token: " + response.error.message);
                    }
                }
                return reject(error);
            }
        };

        xhr.onerror = (error) => {
            console.log("METHOD sendAudio: XMLHttpRequest: " + error);
            reject(error);
        };

        const BOUNDARY = 'BOUNDARY1234';
        const BOUNDARY_DASHES = '--';
        const NEWLINE = '\r\n';

        const REQUESTDATA_CONTENT_DISPOSITION = 'Content-Disposition: form-data; name="request"';
        const REQUESTDATA_CONTENT_TYPE = 'Content-Type: application/json; charset=UTF-8';

        const AUDIO_CONTENT_DISPOSITION = 'Content-Disposition: form-data; name="audio"';
        const AUDIO_CONTENT_TYPE = 'Content-Type: audio/L16; rate=16000; channels=1';

        const metadata = {
            messageHeader: {},
            messageBody: {
                profile: 'alexa-close-talk',
                locale: 'en-us',
                format: 'audio/L16; rate=16000; channels=1'
            }
        };

        // Build the Recognize Speech Request
        const postDataStart = [
            NEWLINE, BOUNDARY_DASHES, BOUNDARY, NEWLINE, REQUESTDATA_CONTENT_DISPOSITION, NEWLINE, REQUESTDATA_CONTENT_TYPE,
            NEWLINE, NEWLINE, JSON.stringify(metadata), NEWLINE, BOUNDARY_DASHES, BOUNDARY, NEWLINE,
            AUDIO_CONTENT_DISPOSITION, NEWLINE, AUDIO_CONTENT_TYPE, NEWLINE, NEWLINE
        ].join('');

        const postDataEnd = [NEWLINE, BOUNDARY_DASHES, BOUNDARY, BOUNDARY_DASHES, NEWLINE].join('');

        var TOKEN = "Atza|IwEBIJ3so4M-cD608CdWmyOmr_L9mv0QKVoR_IRJxrf79keNT0l3cstlaOaoRlwPJv_VNqOilQZM-PrpfY4lS9GvoSpphmrWxu2GrmH6Tqdf9NvhPvzqXPEtfHaM5we94uP7wBmz7N-oD1yIq6_74KBEQkGsos7iEaYVgApzSj48rYwFP_kS7KwJwmnnjfMQvkKosL2SSHB9CqyVUkgBlf1JGEO9nKJKyqllPC-IY6t7pq5UeIXPnFhgeh2IsHrnJ-c_RPQ_W5LWf865upmW0l9PerEqJGGTn4UWupABwySLz7afk_4kg6BHzBccbLL-rar2JLwhUZ4WAoM8TMe6_VGjRmmhwd_l5j6wjUgM8_7J9DCTFsimAxqBSzZYlT9VioVhFxVENfYXypenMXtpNEy9OTGFomG0r-D5g3tV3lTcX2XMUaML1poJwlQCRFH0meBwtN0i1h5o6wPxuE2Qx-tJxZcFrVo2OZ8xJEF_n06iC5Xw0YXcnPpD_DAcpaQfkMVia2O6IdFfMkXTCDvNeyWxEfkJ";

        /*        let buffer = fs.readFileSync('./alexa.wav');
                let ab = toArrayBuffer(buffer);
        */

        //let ab = Array.from(audio);
        //let b = toBuffer(audio);
        //let ab = toArrayBuffer(b);
        //let d = new DataView(ab);
        //console.log("bytelength:" + d.byteLength);
        //console.log("d:" + d);

        const _length = audio.channelData[0].length;
        const _sampleRate = audio.sampleRate;

        const buffer = new ArrayBuffer(44 + _length * 2);
        const view = new DataView(buffer);

        writeUTFBytes(view, 0, 'RIFF');
        view.setUint32(4, 44 + _length * 2, true);
        writeUTFBytes(view, 8, 'WAVE');
        writeUTFBytes(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, _sampleRate, true);
        view.setUint32(28, _sampleRate * 4, true);
        view.setUint16(32, 4, true);
        view.setUint16(34, 16, true);
        writeUTFBytes(view, 36, 'data');
        view.setUint32(40, _length * 2, true);

        const _volume = 1;
        let _index = 44;

        for (let i = 0; i < _length; i++) {
            console.log("audio: " + audio.channelData[0][i]);
            view.setInt16(_index, audio.channelData[0][i] * (0x7FFF * _volume), true);
            _index += 2;
        }

        const size = postDataStart.length + view.byteLength + postDataEnd.length;
        console.log("size:" + size);

        const uint8Array = new Uint8Array(size);
        let i = 0;

        for (; i < postDataStart.length; i++) {
            uint8Array[i] = postDataStart.charCodeAt(i) & 0xFF;
        }

        for (let j = 0; j < view.byteLength; i++, j++) {
            uint8Array[i] = view.getUint8(j);
        }

        for (let j = 0; j < postDataEnd.length; i++, j++) {
            uint8Array[i] = postDataEnd.charCodeAt(j) & 0xFF;
        }

        const payload = uint8Array.buffer;
        //onsole.log("Payload: " + String.fromCharCode.apply(null, new Uint8Array(payload)).substring(1, 200));
        console.log("Token: " + TOKEN);

        xhr.setRequestHeader('Authorization', 'Bearer ' + TOKEN);
        xhr.setRequestHeader('Content-Type', 'multipart/form-data; boundary=' + BOUNDARY);
        //xhr.setRequestHeader('Transfer-Encoding', 'chunked');
        xhr.send(payload);

        var options = {
            method: 'POST',
            url: 'https://access-alexa-na.amazon.com/v1/avs/speechrecognizer/recognize',
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
            console.log(" - header: " + JSON.stringify({
                headers: headers
            }));

            ws.emit(JSON.stringify({
                headers: headers
            }));

            const responseAudioStream = new stream.PassThrough();

            responseAudioStream.end(bodyBuffer);
            responseAudioStream.on('data', function(data) {
                console.log(" - responseAudioStream.on: data -> ws.emit(data)");

                ws.emit(data, {
                    binary: true
                });
            });

        case 'application/json':

            console.log(" - application/json");

            var body = JSON.parse(bodyBuffer.toString('utf8'));
            var directives = _.get(body, ['messageBody', 'directives']);
            var streamUrls = [];

            if (directives) {
                console.log(" - directives: " + JSON.stringify({
                    directives
                }));

                body.messageBody.directives = directives.map(function(directive, i) {

                    var audioItem = _.get(directive, ['payload', 'audioItem']);
                    console.log(" - audioItem: " + JSON.stringify({
                        audioItem
                    }));

                    if (audioItem) {
                        var streams = _.get(audioItem, 'streams');
                        console.log(" - streams: " + JSON.stringify({
                            streams
                        }));

                        if (streams) {
                            directive.payload.audioItem.streams = streams.map(function(stream, j) {
                                if (/^https?/.test(stream.streamUrl)) {
                                    streamUrls.push({
                                        propertyPath: ['messageBody', 'directives', i, 'payload', 'audioItem', 'streams', j],
                                        url: stream.streamUrl
                                    });
                                }

                                console.log(" - return stream: " + JSON.stringify({
                                    stream
                                }));
                                return stream;
                            });
                        }
                    }
                    console.log(" - return directive: " + JSON.stringify({
                        directive
                    }));
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
                        console.log(" - urls.push(bodyResponse): " + JSON.stringify({
                            bodyResponse
                        }));
                        _.set(body, stream.propertyPath.concat('streamMp3Urls'), urls);

                        if (++completed === streamUrlsSize) {
                            console.log(" - call to: _main.send(headers, new Buffer(JSON.stringify(body)), ws);");
                            console.log(" - body: " + JSON.stringify({
                                body
                            }));
                            _main.send(headers, new Buffer(JSON.stringify(body)), ws);
                        }
                    });
                });
            }
            else {
                console.log(" - call to: _main.send(headers, bodyBuffer, ws);");
                console.log(" - bodyBuffer: " + JSON.stringify({
                    bodyBuffer
                }));
                _main.send(headers, bodyBuffer, ws);
            }
    }
};

//-----------------------------------------------------------------------------
// Send to the Websocket
//-----------------------------------------------------------------------------
exports.send = function(headers, bodyBuffer, ws) {

    ws.emit(JSON.stringify({
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

    var TOKEN = "Atza|IwEBIABSiGX-qwFZBtDymBLW8CV_guK74b8u3Ttu8DoXFCTpWiDP8KtS9SrxYlUb_ObHKkpEFR-u67adkdTm6SCWL2dGLZXAvBimLrLrgGYSqao9kYVc-8cMBjl5Xo-NSBs8wIE9tCooq9ke0-1bPGR8VW9xo7bkYs0Uii41l-qN8YGnOPcbDhthiyckNk34Sifm8exKY44jdfQO8uROeln8aGrIWZ0c12jhr6o-Z8SlcuaKgpaPOrljUTyE_RJCkpz5aNTrKAhl0dB7KGrdaO4s4nB333Ur-BDIDSkBgKL4K0qEBgu2d7LJ2LXjpDzNRY1S44z1mbx6Tb1L0492keDTmrOp9GyGFnwKEaFMy3Ghmt-moasJOSe-uox_U6nlRJ66gTuOpglijJtLEUqSHXVkLQOyGeaQDuQOtd66aA-3RDrouxKnLsK-bOF0cI4s9T_s9O3udRKInSiMYTsjom43mjnF-gLkNzYOTY7KhfUuAF6LBDvORAFnVc2gVWcrEvIA8JuZ7VY90MjzvhqRG-7N67hX";

    const headers = {
        'Authorization': 'Bearer ' + TOKEN,
        'Content-Type': 'multipart/form-data; boundary=' + BOUNDARY
    };

    const metadata = {
        messageHeader: {},
        messageBody: {
            profile: 'alexa-close-talk',
            locale: 'en-us',
            format: 'audio/L16; rate=16000; channels=1'
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
        //port: 443,
        path: '/v1/avs/speechrecognizer/recognize',
        method: 'POST',
        headers: headers,
        encoding: 'binary'
    };

    console.log("---------------------------");
    console.log("BEGIN: postToWS");

    console.log("http to AVS - options: " + JSON.stringify(options));

    const req = http.request(options, function(res) {

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

    var buffer = JSON.stringify(audBuffer);

    console.log("- BEGIN: sendRequest");
    console.log("- postDataStart: " + JSON.stringify(postDataStart));
    console.log("- audBuffer: " + buffer.substring(0, 60) + '....');
    console.log("- postDataEnd:   " + JSON.stringify(postDataEnd));
    console.log("- END: sendRequest");

    req.write(postDataStart);
    req.write(audBuffer);
    req.write(postDataEnd);
    req.end();
};

//-----------------------------------------------------------------------------
// Test harness
//-----------------------------------------------------------------------------
exports.somethingElse = function(request, response) {
    console.log("something ...");
    response.status(201).json("Found Something Else ...");
};
