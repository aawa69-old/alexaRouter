var express = require('express');
var app = express(); 

var http = require('http');
var fs = require('fs');

var logger = require('./logger');   // require and use the logger.js module
app.use(logger);                    // 'app.use' adds the module to the stack 

app.use(express.static('public'));  //static middleware serving files from the 'public' folder

var process = require('./main'); 

// returns route object which handles all requests to the /blocks path
router.route('/')
	.post(parseUrlencoded, function(request, response) {
        processBody(request.body);

		watson.textToSpeech(sometext);   // using alternate me

    	response.json(Object.keys(blocks)); 		// convert to json
	});

// listen on port 3000
app.listen(3000, function() {
    console.log('Listening on port 3000');
});


