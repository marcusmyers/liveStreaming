var RaspiCam = require("raspicam");
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var fs = require('fs');
var path = require('path');

var spawn = require('child_process').spawn;
var proc;

var camera = new RaspiCam({  
	mode: "timelapse",
	output: "./stream/image.jpg", // image_000001.jpg, image_000002.jpg,...
	encoding: "jpg",
	timelapse: 3000, // take a picture every 3 seconds
	timeout: 9999999999 // take a total of 4 pictures over 12 seconds
});

app.use('/', express.static(__dirname, '/'));
app.use('/stream', express.static(__dirname, '/stream')); 
app.get('/', function(req, res) {
  res.sendFile(__dirname + '/index.html');
});


var sockets = {};

camera.on("start", function( err, timestamp ){
	console.log("timelapse started at " + timestamp);
});

camera.on("read", function( err, timestamp, filename ){
	console.log("timelapse image captured with filename: " + filename);
});

camera.on("exit", function( timestamp ){
	console.log("timelapse child process has exited");
});

camera.on("stop", function( err, timestamp ){
	console.log("timelapse child process has been stopped at " + timestamp);
});


io.on('connection', function(socket) {
 
  sockets[socket.id] = socket;
  console.log("Total clients connected : ", Object.keys(sockets).length);
 
  socket.on('disconnect', function() {
    delete sockets[socket.id];
 
    // no more sockets, kill the stream
    if (Object.keys(sockets).length == 0) {
      app.set('watchingFile', false);
      if (proc) proc.kill();
      fs.unwatchFile('./stream/image.jpg');
    }
  });
 
  socket.on('start-stream', function() {
    startStreaming(io);
  });
 
});

camera.start();

http.listen(3000, function() {
  console.log('listening on *:3000');
});

// test stop() method before the full 12 seconds is up
setTimeout(function(){
	camera.stop();
}, 1000000000);

function stopStreaming() {
  if (Object.keys(sockets).length == 0) {
    app.set('watchingFile', false);
    if (proc) proc.kill();
    fs.unwatchFile('./stream/image.jpg');
  }
}

function startStreaming(io) {
 
  if (app.get('watchingFile')) {
    io.sockets.emit('liveStream', '/stream/image.jpg?_t=' + (Math.random() * 100000));
    return;
  }
 
 
  console.log('Watching for changes...');
 
  app.set('watchingFile', true);
 
  fs.watchFile('./stream/image.jpg', function(current, previous) {
    io.sockets.emit('liveStream', '/stream/image.jpg?_t=' + (Math.random() * 100000));
  })
 
}
