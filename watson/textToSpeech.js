
// Process the input text - call watson text-to-speech api and stream to file
exports.textToSpeech = function(input) {
    var TextToSpeechV1 = require('watson-developer-cloud/text-to-speech/v1');
    var fs = require('fs');

    var text_to_speech = new TextToSpeechV1 ({
        username: '{username}',
        password: '{password}',
        headers: {
            'X-Watson-Learning-Opt-Out': 'true'
        }
    });

    var params = {
      text: input,
      voice: 'en-US_AllisonVoice',
      accept: 'audio/wav'
    };

    // Pipe the synthesized text to a file.
    text_to_speech.synthesize(params).pipe(fs.createWriteStream('./alexa.wav'));
};

exports.somethingElse = function() {
    console.log("something ...");
};