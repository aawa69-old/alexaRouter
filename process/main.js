// Process the input text - call watson text-to-speech api and stream to file
exports.main = function(reqBody) {

    var watson = require('./watson'); 

exports.main = function(reqBody) {

    if(reqBody.resource === "messages" && reqbody.event === "created") {    
        var target = reqbody.targetUrl;
        var message = reqbody.data.id;

        var options = {
        host: 'somesite.com',
        port: 443,
        path: '/some/path',
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }

            var prot = options.port == 443 ? https : http;
    var req = prot.request(options, function(res)
    {
        var output = '';
        console.log(options.host + ':' + res.statusCode);
        res.setEncoding('utf8');

        res.on('data', function (chunk) {
            output += chunk;
        });

        res.on('end', function() {
            var obj = JSON.parse(output);
            onResult(res.statusCode, obj);
        });
    });

    req.on('error', function(err) {
        //res.send('error: ' + err.message);
    });

    req.end();

        
};   

    }

};


};

exports.somethingElse = function() {
    console.log("something ...");
};