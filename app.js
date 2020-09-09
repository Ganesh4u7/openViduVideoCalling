var express = require('express');
var path = require('path');
var cors = require('cors');

var fs = require('fs');
var session = require('express-session');
var https = require('https');
var bodyparser = require('body-parser');
var mongoose = require('mongoose');

var app = express();

// const uri = "mongodb://roger:thebest1@ds027495.mlab.com:27495/diet-plan";
// mongoose.connect(uri,{ useNewUrlParser: true });
// var db = mongoose.connection;
// db.on("error", console.error.bind(console, "connection error"));
// db.once("open", function(callback) {
//   console.log("Connection succeeded.");
// });

app.use(bodyparser());
app.use(bodyparser.json());
app.use(bodyparser.urlencoded({ extended: false }));


app.use(cors());
var corsOptions = {
  origin: '*',
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
}
app.options('*', cors())

app.use(function(req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,PATCH,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  next();
});

// Server configuration
app.use(session({
  saveUninitialized: true,
  resave: false,
  secret: 'MY_SECRET'
}));

app.use(express.static(path.join(__dirname, './dist/videoCalling')));
app.get('/',function(req,res){
  res.sendFile(path.join(__dirname,"./dist/videoCalling/index.html"));
});

 app.use('',require('./routes/requests'));


module.exports = app;
