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
const toBuffer = require('typedarray-to-buffer');
const toArrayBuffer = require('to-arraybuffer');
const WavDecoder = require("wav-decoder");
var util = require('util');
var https = require('https');

const arrayBufferToString = require('./arrayBufferToString.js');
const writeUTFBytes = require('./writeUTFBytes.js');
var tts = require('./textToSpeech.js');
const AMAZON_ERROR_CODES = require('./AmazonErrorCodes.js');

const TMP = require('../tmp/test.json');

const TOKEN_JSON_FILE = __dirname + '/token.json';
//var TOKEN = "Atza|........";

//-----------------------------------------------------------------------------
// Method: Main
// Process the input text - call watson text-to-speech api and stream to file
//-----------------------------------------------------------------------------
exports.main = function(request, response) {

    //TOKEN = _main.loadTokenFromFile(); // TEMPORARY - Load the token from static file 

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

            // Call Microsoft Speech-to-Text API
            _main.textToSpeech(msgObj.text)
                .then(audioBuffer => {

                    var buff = audioBuffer;
                    console.log('BEGIN: bufferWav');
                    console.log("Typeof payload: " + Object.prototype.toString.call(audioBuffer));
                    //console.log("Object keys: " + Object.keys(audioBuffer));
                    console.log("Object length: " + audioBuffer.length);

                    _main.sendAudio(audioBuffer)
                        .then((response) => {

                            var promises = [];
                            var audioMap = {};
                            var directives = null;

                        })
                        .catch(error => {
                            console.error(error);
                        });

                    /*
                                        _main.bufferWav()
                                            .then((audio) => {
                                                console.log(audio.sampleRate);

                                                _main.sendAudio(audio)
                                                    .then((response) => {

                                                        var promises = [];
                                                        var audioMap = {};
                                                        var directives = null;

                                                    })
                                                    .catch(error => {
                                                        console.error(error);
                                                    });
                                            });
                    */
                })
                .catch(error => {
                    console.error(error);
                });
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
    //alexaText = alexaIdx >= 0 ? newText.slice(alexaIdx + 6) : alexaIdx;
    //alexaText = encodeURIComponent(alexaText.trim(alexaText));

    alexaText = newText;

    console.log("GetMsgText: converted text - " + alexaText);
    return alexaText;
};

//-----------------------------------------------------------------------------
// Method: textToSpeech
// Call the Watson Text-to-Speech service
//-----------------------------------------------------------------------------
/*exports.textToSpeech = function(text) {

    return new Promise((resolve, reject) => {
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
                accept: 'audio/wav;rate=16000' //audio/l16;rate=16000'
            };

            // Pipe the synthesized text to a file
            //text_to_speech.synthesize(params).pipe(fs.createWriteStream('./alexa.wav'));

            var audio = tts.Synthesize("what time is it"); 

            var fileLen = _main.getFilesizeInBytes();
            console.log("METHOD: textToSpeech: alexa.wav length - " + fileLen);
            return resolve(fileLen);
        }
    });
};
*/

//-----------------------------------------------------------------------------
// Method: textToSpeech
// Call the Microsoft Speech Service
//-----------------------------------------------------------------------------
exports.textToSpeech = function(text) {

    return new Promise((resolve, reject) => {
        // Note: The way to get api key:
        // Free: https://www.microsoft.com/cognitive-services/en-us/subscriptions?productId=/products/Bing.Speech.Preview
        // Paid: https://portal.azure.com/#create/Microsoft.CognitiveServices/apitype/Bing.Speech/pricingtier/S0
        var apiKey = ".....";
        var post_data = text;

        var AccessTokenUri = "https://api.cognitive.microsoft.com/sts/v1.0/issueToken";

        var post_option = {
            hostname: 'api.cognitive.microsoft.com',
            port: 443,
            path: '/sts/v1.0/issueToken',
            method: 'POST'
        };

        post_option.headers = {
            'Ocp-Apim-Subscription-Key': apiKey,
            'Content-Length': post_data.length
        };

        var post_req = https.request(post_option, function(res) {
            var accessToken = "";

            res.on('data', function(buffer) {
                accessToken += buffer;
            });

            // end callback
            res.on('end', function() {
                console.log("Access token: ", accessToken);

                // call tts service
                var https = require('https');

                var ttsServiceUri = "https://speech.platform.bing.com/synthesize";

                var post_option = {
                    hostname: 'speech.platform.bing.com',
                    port: 443,
                    path: '/synthesize',
                    method: 'POST'
                };

                var SsmlTemplate = "<speak version='1.0' xml:lang='en-us'><voice xml:lang='%s' xml:gender='%s' name='%s'>%s</voice></speak>";
                var post_speak_data = util.format(SsmlTemplate, 'en-US', 'Female', 'Microsoft Server Speech Text to Speech Voice (en-US, ZiraRUS)', post_data);

                post_option.headers = {
                    'content-type': 'application/ssml+xml',
                    'Content-Length': post_speak_data.length,
                    'X-Microsoft-OutputFormat': 'riff-16khz-16bit-mono-pcm',
                    'Authorization': 'Bearer ' + accessToken,
                    'X-Search-AppId': '07D3234E49CE426DAA29772419F436CA',
                    'X-Search-ClientID': '1ECFAE91408841A480F00935DC390960',
                    "User-Agent": "TTSNodeJS"
                };

                var post_tts = https.request(post_option, function(res) {
                    
                    var writeStream = fs.createWriteStream('./MSSpeech.raw');
                    res.pipe(writeStream);
                    
                    var _data = "";
                    res.on('data', function(buffer) {
                        //get the wave
                        _data += buffer;
                    });

                    // end callback
                    res.on('end', function() {
                        console.log('tts wave data.length: ' + _data.length);
                        resolve(_data);
                    });

                    post_tts.on('error', function(e) {
                        console.log('problem with tts request: ' + e.message);
                        reject(e);
                    });
                });

                console.log('\n\ntts post_speak_data: ' + post_speak_data + '\n');
                post_tts.write(post_speak_data);
                post_tts.end();

            });

            post_req.on('error', function(e) {
                console.log('problem with tts auth request: ' + e.message);
                accessToken = null;
                reject(e);
            });
        });

        post_req.write(post_data);
        post_req.end();
        
    });
};

exports.getFilesizeInBytes = function() {

    var stats = fs.statSync('./alexa.wav');
    var fileSizeInBytes = stats["size"];
    return fileSizeInBytes;

};

//-----------------------------------------------------------------------------
// Method: bufferWav
// Call the Watson Text-to-Speech service
//-----------------------------------------------------------------------------
exports.bufferWav = function() {

    return new Promise((resolve, reject) => {
        const readFile = (filepath) => {
            return new Promise((resolve, reject) => {
                fs.readFile(filepath, (err, buffer) => {
                    if (err) {
                        return reject(err);
                    }
                    return resolve(buffer);
                });
            });
        };

        readFile("./MS.wav")
            .then((buffer) => {
                return WavDecoder.decode(buffer);
            })
            .then(function(audioData, err) {

                if (err) {
                    console.log(err);
                }

                var _length = audioData.channelData[0].length;
                console.log("Audio length: " + _length);
                var _result = new Float32Array(_length);
                let _offset = 0;

                for (let i = 0; i < _length; i++) {
                    let buffer = [audioData.channelData[0][i]];

                    //console.log("buffer: " + buffer);
                    //console.log("offset: " + _offset);

                    _result.set(buffer, _offset);
                    _offset += buffer.length;
                }

                var _audio = {};

                _audio.length = _result.length;
                _audio.sampleRate = audioData.sampleRate;
                _audio.channelData = _result;
                return resolve(_audio);
            });
    });
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
exports.sendAudio = function(audio) {

    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const url = 'https://access-alexa-na.amazon.com/v1/avs/speechrecognizer/recognize';

        xhr.open('POST', url, true);
        xhr.responseType = 'arraybuffer';

        xhr.onload = (event) => {
            console.log("Response status: " + xhr.status + " : " + xhr.statusText + xhr.responseText);
            console.log("Response headers: " + xhr.getAllResponseHeaders().toLowerCase());
            console.log("Response event: " + JSON.stringify(event));

            var resp = xhr.response;

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

        const REQUESTDATA_CONTENT_DISPOSITION = 'Content-Disposition: form-data; name="metadata"';
        const REQUESTDATA_CONTENT_TYPE = 'Content-Type: application/json; charset=UTF-8';

        const AUDIO_CONTENT_DISPOSITION = 'Content-Disposition: form-data; name="audio"';
        const AUDIO_CONTENT_TYPE = 'Content-Type: audio/L16; rate=16000; channels=1';

        //{"messageHeader":{"deviceContext":[{"name":"playbackState", "namespace":"AudioPlayer", "payload":{"streamId":"", "offsetInMilliseconds":"0", "playerActivity":"IDLE"}}]}, 
        //"messageBody":{"profile":"doppler-scone", "locale":"en-us", "format":"audio/L16; rate=16000; channels=1"}}

        const metadata = {
            messageHeader: {
                deviceContext: [{
                    "name": "playbackState",
                    "namespace": "AudioPlayer",
                    "payload": {
                        "streamId": "",
                        "offsetInMilliseconds": "0",
                        "playerActivity": "IDLE"
                    }
                }]
            },
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

        var TOKEN = "Atza|.........";

        /*        let buffer = fs.readFileSync('./alexa.wav');
                let ab = toArrayBuffer(buffer);
        */

        //let ab = Array.from(audio);
        //let b = toBuffer(audio);
        //let ab = toArrayBuffer(b);
        //let d = new DataView(ab);
        //console.log("bytelength:" + d.byteLength);
        //console.log("d:" + d);

        var _length = audio.length;
        //var _sampleRate = audio.sampleRate;

/*
        var buffer = new ArrayBuffer(44 + _length * 2);
        var view = new DataView(buffer);
        const _outputSampleRate = 16000;
        
        writeUTFBytes(view, 0, 'RIFF');
        view.setUint32(4, 44 + _length * 2, true);
        writeUTFBytes(view, 8, 'WAVE');
        writeUTFBytes(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, _outputSampleRate, true);
        view.setUint32(28, _outputSampleRate * 4, true);
        view.setUint16(32, 4, true);
        view.setUint16(34, 16, true);
        writeUTFBytes(view, 36, 'data');
        view.setUint32(40, _length * 2, true);
       
        const _volume = 1;
        let _index = 44;
*/

        // without header - begin
        var buffer = new ArrayBuffer(_length * 2);
        var view = new DataView(buffer);

        const _volume = 1;
        let _index = 0;
        // without header - end 

        for (let i = 0; i < _length; i++) {
            //console.log("audio: " + audio.channelData[i]);
            //view.setInt16(_index, audio.channelData[i] * (0x7FFF * _volume), true);
            //view.setInt16(_index, audio[i] * (0x7FFF * _volume), true);            
            view.setInt16(_index, audio[i], true);            
            _index += 2;
        }

        var size = postDataStart.length + view.byteLength + postDataEnd.length;
        console.log("size:" + size);

        var uint8Array = new Uint8Array(size);
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

        console.log("Typeof payload: " + Object.prototype.toString.call(audio));
        var payload = toBuffer(uint8Array);
        //var payload = uint8Array.buffer;
        //console.log("Typeof payload: " + Object.prototype.toString.call(payload));
        //console.log("Object keys: " + Object.keys(payload));

        console.log("Token: " + TOKEN);

        xhr.setRequestHeader('Authorization', 'Bearer ' + TOKEN);
        xhr.setRequestHeader('Content-Type', 'multipart/form-data; boundary=' + BOUNDARY);
        xhr.send(payload);
    });
};


//-----------------------------------------------------------------------------
// Method: sendAudio
// Call AVS
//-----------------------------------------------------------------------------
exports.sendAudioALT = function(audio) {

    return new Promise((resolve, reject) => {

        const TOKEN = "Atza|.....";

        const BOUNDARY = 'BOUNDARY1234';
        const BOUNDARY_DASHES = '--';
        const NEWLINE = '\r\n';

        const REQUESTDATA_CONTENT_DISPOSITION = 'Content-Disposition: form-data; name="request"';
        const REQUESTDATA_CONTENT_TYPE = 'Content-Type: application/json; charset=UTF-8';

        const AUDIO_CONTENT_DISPOSITION = 'Content-Disposition: form-data; name="audio"';
        const AUDIO_CONTENT_TYPE = 'Content-Type: audio/L16; rate=16000; channels=1';

        const _headers = {
            'Authorization': 'Bearer ' + TOKEN,
            'Content-Type': 'multipart/form-data; boundary=' + BOUNDARY
        };

        const _metadata = {
            messageHeader: {},
            messageBody: {
                profile: 'alexa-close-talk',
                locale: 'en-us',
                format: 'audio/L16; rate=16000; channels=1'
            }
        };

        // Build the Recognize Speech Request
        const _postDataStart = [
            NEWLINE, BOUNDARY_DASHES, BOUNDARY, NEWLINE, REQUESTDATA_CONTENT_DISPOSITION, NEWLINE, REQUESTDATA_CONTENT_TYPE,
            NEWLINE, NEWLINE, JSON.stringify(_metadata), NEWLINE, BOUNDARY_DASHES, BOUNDARY, NEWLINE,
            AUDIO_CONTENT_DISPOSITION, NEWLINE, AUDIO_CONTENT_TYPE, NEWLINE, NEWLINE
        ].join('');

        const _postDataEnd = [NEWLINE, BOUNDARY_DASHES, BOUNDARY, BOUNDARY_DASHES, NEWLINE].join('');

        const options = {
            hostname: 'access-alexa-na.amazon.com',
            path: '/v1/avs/speechrecognizer/recognize',
            method: 'POST',
            headers: _headers,
            encoding: 'binary'
        };

        var req = https.request(options, function(res) {

            const buffer = new Buffer(res);

            if (res.statusCode === 200) {
                var parsedMessage = httpParser(buffer);
                resolve(parsedMessage);
            }
            else {
                let error = new Error('An error occured with request.');
                let response = {};

                if (!buffer.byteLength) {
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

            req.on('error', function(e) {
                console.log('Problem with request: ' + e.message);
            });

        });

        /*        let buffer = fs.readFileSync('./alexa.wav');
                let ab = toArrayBuffer(buffer);
        */

        //let ab = Array.from(audio);
        //let b = toBuffer(audio);
        //let ab = toArrayBuffer(b);
        //let d = new DataView(ab);
        //console.log("bytelength:" + d.byteLength);
        //console.log("d:" + d);

        var _length = audio.channelData[0].length;
        var _sampleRate = audio.sampleRate;

        var buffer = new ArrayBuffer(44 + _length * 2);
        var view = new DataView(buffer);

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

        var _volume = 1;
        let _index = 44;

        for (let i = 0; i < _length; i++) {
            //if(audio.channelData[0][i] > 0) console.log("audio: " + audio.channelData[0][i]);
            view.setInt16(_index, audio.channelData[0][i] * (0x7FFF * _volume), true);
            _index += 2;
        }

        var size = _postDataStart.length + view.byteLength + _postDataEnd.length;
        console.log("size:" + size);

        var uint8Array = new Uint8Array(size);
        let i = 0;

        for (; i < _postDataStart.length; i++) {
            uint8Array[i] = _postDataStart.charCodeAt(i) & 0xFF;
        }

        let c = 0;
        for (let j = 0; j < view.byteLength; i++, j++) {
            if (view.getUint8(j) > 0) {
                if (c < 10) {
                    console.log("view.getUint8: " + view.getUint8(j));
                    c++;
                }
            }
            uint8Array[i] = view.getUint8(j);
        }

        for (let j = 0; j < _postDataEnd.length; i++, j++) {
            uint8Array[i] = _postDataEnd.charCodeAt(j) & 0xFF;
        }

        const payload = uint8Array.buffer;
        console.log("uint8Array size: " + uint8Array.length);
        console.log("uint8Array buffer size: " + uint8Array.buffer.length);
        let s = JSON.stringify(uint8Array.buffer);
        console.log("uint8Array.buffer: " + s);

        if (isStream(payload)) {
            streamToBuffer(payload, function(error, buffer) {
                if (error) {
                    console.error(error);
                    return false;
                }
                sendRequest(buffer);
            });
        }
        else if (isBuffer(payload)) {
            sendRequest(payload);
        }
        else {
            console.error('Audio buffer invalid');
        }


        function sendRequest(audio) {

            req.write(_postDataStart);
            req.write(payload);
            req.write(_postDataEnd);
            req.end();
        }

    });

};

//-----------------------------------------------------------------------------
// Test harness
//-----------------------------------------------------------------------------
exports.somethingElse = function(request, response) {
    console.log("something ...");
    response.status(201).json("Found Something Else ...");
};
