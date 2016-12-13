
var _main = this;

//-----------------------------------------------------------------------------
// Process the input text - call watson text-to-speech api and stream to file
//-----------------------------------------------------------------------------
exports.main = function(request, response) {

    var https = require('https');
    //var watson = require('../watson/textToSpeech'); 
    
    console.log('Body: ' + JSON.stringify(request.body));
 
    var reqBody = request.body;

    console.log('Resource: ' + reqBody.resource + ' - Event: ' + reqBody.event);

    if(!(reqBody.resource === "messages" && reqBody.event === "created")) {   
        request.status(400).json('Not a new message');
    }
    
    console.log('BEGIN: https call to get message ...');

    var message = reqBody.data.id;                  // get the message id
    console.log('Message id: ' + message);

    var options = {                                 //  Options for the call to cisco messages
        host: 'api.ciscospark.com',
        path: '/v1/messages/' + message,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': '{your cisco bearer token}'
        }
    };    

    var req = https.get(options, function(res)      // get the message                     
    {
        var output = '';
        console.log('Host: ' + options.host + ' - Status: ' + res.statusCode);
        res.setEncoding('utf8');

        res.on('data', function (chunk) {
            output += chunk;
        });

        res.on('end', function() {                  // process the message 'text'
            var msgObj = JSON.parse(output);
            console.log('Output: ' + msgObj.text);

            _main.textToSpeech(msgObj.text);       // call watson and generate the WAV file        
            response.status(201).json("WAV file created ...");
        });
    });

    req.on('error', function(err) {                 // something went wrong
        console.log('Https call failed: ' + err.message);
        request.status(400).json('GET Error: ' + err.message);
    });

    req.end(console.log('END: https call to get message ...'));

};

//-----------------------------------------------------------------------------
// Process the retrieve message text - determine it's for alexa and format
//-----------------------------------------------------------------------------
exports.getMsgText = function(text) {

    var alexaText = "";    
    var newText = text.toLowerCase(text);
    var alexaIdx = newText.indexOf("alexa");
 
    console.log("GetMsgText: instance of 'alexa' - " + alexaIdx + " - Text: " + newText);
    alexaText = alexaIdx >= 0 ? newText.slice(alexaIdx+6) : alexaIdx;
    alexaText = encodeURIComponent(alexaText.trim(alexaText));

    console.log("GetMsgText: converted text - " + alexaText);
    return alexaText;
};

//-----------------------------------------------------------------------------
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
// Test harness 
//-----------------------------------------------------------------------------
exports.somethingElse = function(request, response) {
    console.log("something ...");
    response.status(201).json("Found Something Else ...");
};