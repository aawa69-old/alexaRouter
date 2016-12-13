
var express = require('express');
var bodyParser = require('body-parser'); // form data parsing - npm install body-parser
var app = express(); 
//var router = express.Router();		// return router instance which can be mounted as middeware 

app.use(bodyParser.json());	

//var logger = require('./logger');   // require and use the logger.js module
//app.use(logger);                    // 'app.use' adds the module to the stack 

//app.use(express.static('public'));  //static middleware serving files from the 'public' folder

var process = require('./process/main'); 

// returns route object which handles all requests to the /blocks path
app.post('/', function(request, response) {
	
    process.main(request, response);
    //process.somethingElse(request, response);

	//watson.textToSpeech(sometext);   // using alternate me

	//response.json(Object.keys(blocks)); 		// convert to json
});

// listen on port 3000
app.listen(3000, function() {
    console.log('Listening on port 3000');
});


