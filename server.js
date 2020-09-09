var app= require('./app');
var fs = require('fs');
var debug = require('debug')('mean-app:server');
var http = require('http');

var port = normalizePort(process.env.PORT || '4300');
app.set('port', port);

var options = {
  key: fs.readFileSync('openvidukey.pem'),
  cert: fs.readFileSync('openviducert.pem')
};

var server = http.createServer(options,app);
server.listen(port);
server.on('listening', onListening);
console.log(`server listening on port ${port}`)

function onListening() {
  var addr = server.address();
  debug('Listening on ' + port);
}


function normalizePort(val) {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}
