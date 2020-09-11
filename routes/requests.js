/* CONFIGURATION */

var OpenVidu = require('openvidu-node-client').OpenVidu;
var OpenViduRole = require('openvidu-node-client').OpenViduRole;

// Check launch arguments: must receive openvidu-server URL and the secret
// if (process.argv.length != 4) {
//     console.log("Usage: node " + __filename + " OPENVIDU_URL OPENVIDU_SECRET");
//     process.exit(-1);
// }
// For demo purposes we ignore self-signed certificate
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"

// Node imports
var express = require('express');
var fs = require('fs');
var session = require('express-session');
var https = require('https');
var bodyParser = require('body-parser'); // Pull information from HTML POST (express4)
const { Recording, RecordingMode, RecordingLayout } = require('openvidu-node-client');
var app = express(); // Create our app with express
var recording;

const router = require('express').Router();

// Environment variable: URL where our OpenVidu server is listening
var OPENVIDU_URL = "https://ec2-13-127-86-183.ap-south-1.compute.amazonaws.com";
// Environment variable: secret shared with our OpenVidu server
var OPENVIDU_SECRET = "MY_SECRET";

// Entrypoint to OpenVidu Node Client SDK
var OV = new OpenVidu(OPENVIDU_URL, OPENVIDU_SECRET);
var properties = {
    recordingMode: RecordingMode.MANUAL, // RecordingMode.ALWAYS for automatic recording
    defaultOutputMode: Recording.OutputMode.INDIVIDUAL
};

// Collection to pair session names with OpenVidu Session objects
var mapSessions = {};
// Collection to pair session names with tokens
var mapSessionNamesTokens = {};



router.post('/create_session',(req,res)=>{
    console.log('here');

    var sessionName = req.body.session;
    var sessionPwd = req.body.sessionPwd;
    let tokenOptions = {
        session:sessionName
    }

    if(mapSessions[sessionName]){
        res.send({status:false,payload:"Session name already exists"});
    }
    else{
        // New session
        console.log('New session ' + sessionName);
          
        // Create a new OpenVidu Session asynchronously
        OV.createSession(properties)
            .then(session => {
                // Store the new Session in the collection of Sessions
                mapSessions[sessionName] = session;
                console.log('sesson'+session);
                // Store a new empty array in the collection of tokens
                mapSessionNamesTokens[sessionName] = [];

                // Generate a new token asynchronously with the recently created tokenOptions
                session.generateToken(tokenOptions)
                    .then(token => {
                         console.log(token);

                        // Store the new token in the collection of tokens
                        mapSessionNamesTokens[sessionName].push(token);
                        console.log(mapSessionNamesTokens[sessionName]);
                        // Return the Token to the client
                        res.status(200).send({
                        
                            0: token,
                            status:true
                        });
                    })
                    .catch(error => {
                        console.error(error);
                    });
            })
            .catch(error => {
                console.error(error);
            });
    }

});

router.post('/join_session',(req,res)=>{
    console.log('came here');
    var sessionName = req.body.session;
    var sessionPwd = req.body.sessionPwd;
    let tokenOptions = {
        session:sessionName
    };
    if(mapSessions[sessionName]){
        // Session already exists
        console.log('Existing session ' + sessionName);

        // Get the existing Session from the collection
        var mySession = mapSessions[sessionName];

        // Generate a new token asynchronously with the recently created tokenOptions
        mySession.generateToken(tokenOptions)
            .then(token => {

                // Store the new token in the collection of tokens
                mapSessionNamesTokens[sessionName].push(token);

                // Return the token to the client
                res.status(200).send({
                    status:true,
                    0: token
                });
            })
            .catch(error => {
                console.error(error);
            });

    }
    else{
        res.send({status:false,payload:'Session does not exist'});
    }


});


router.post('/api-sessions/recording',(req,res)=>{
    if(req.body.record == true){
       console.log('enterted');
        var sessionId = mapSessions[req.body.session].sessionId;
        console.log(sessionId);
  
        let recordOptions = {
          outputMode: Recording.OutputMode.COMPOSED,
          name: "MY_RECORDING_NAME",
          hasAudio: true,     // Whether you want to start publishing with your audio unmuted or not
          hasVideo: true     // Whether you want to start publishing with your video enabled or not
            
      };
          // Starts recording
          OV.startRecording(sessionId,recordOptions)
            .then((response)=>{
                recording=response;
                console.log(response);
                res.send({success:true});
            })
            .catch(error => console.error(error));
  
    }
    else{
        console.log(recording.id);
          OV.stopRecording(recording.id)
          .then(recordingStopped =>{  res.send({success:true,recording:"stopped"}) });
    }
  })

module.exports = router;