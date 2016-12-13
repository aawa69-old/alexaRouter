
// Process the input text - call watson text-to-speech api and stream to file
exports.main = function(request, response) {

    var https = require('https');
    var watson = require('./watson'); 
    
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
            'Authorization': '{your bearer token}'
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
            var obj = JSON.stringify(output);
            console.log('Output: ' + obj);
            //response.status(201).json(output);
            var msgText = watson.getMsgText(output.text);
            if(msgText) {
                watson.textToSpeech(msgText);
            } 
        });
    });

    req.on('error', function(err) {                 // something went wrong
        console.log('Https call failed: ' + err.message);
        request.status(400).json('GET Error: ' + err.message);
    });

    req.end(console.log('END: https call to get message ...'));

};

exports.somethingElse = function(request, response) {
    console.log("something ...");
    response.status(201).json("Found Something Else ...");
};