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
// Method: textToSpeech
// Call the Watson Text-to-Speech service
//-----------------------------------------------------------------------------
exports.alexaSpeechRecognizer = function(text) {

    var options = {
        url: 'https://access-alexa-na.amazon.com/v1/avs/speechrecognizer/recognize',
        headers: {
            'Content-Type': 'multipart/form-data',
            'Transfer-Encoding': 'chunked'
        },
        formData: formData
    };

    var destination = fs.createWriteStream(path.join(__dirname, outputfile));

    //request.debug = 1;
    request.post(options, function optionalCallback(err, httpResponse, body) {
            //console.log(httpResponse);
            if (body.length < 100) {
                console.log(body);
            }
            console.log("\n\r----Processing Done to (" + outputfile + ")----");
            if (loadingInt != null) clearInterval(loadingInt);
            process.exit();
            if (err) {
                return console.error('upload failed:', err);
            }
            //console.log('Upload successful!  Server responded with:', body);
        }).auth(null, null, true, token)
        .pipe(destination);
};

//-----------------------------------------------------------------------------
// Test harness
//-----------------------------------------------------------------------------
exports.somethingElse = function(request, response) {
    console.log("something ...");
    response.status(201).json("Found Something Else ...");
};
