var http = require("http");
require('./scripts/viewModel.js');
var express = require('express');
var path = require('path');
var app = express();


var client_id = '7e1ec46b-77ac-4fa1-8fb0-1979e73e65fa';
var client_secret = 'E1Zv5SQJ2-8u5Xb7jnP4-W5zEgRwdZLPiC9VnG3fPXY';


app.get('/', function(req, res) {
	console.log("Start session");
    res.sendFile('./index.html', {root: __dirname });
});

app.get('/main.html', function(req, res) {
	console.log("Start session");
    res.sendFile('./main.html', {root: __dirname });
});

app.use(express.static(path.join(__dirname, 'scripts')));
app.use(express.static(path.join(__dirname, 'styles')));
app.use(express.static(path.join(__dirname, 'img')));


var httpServer = http.createServer(app);
httpServer.listen('8085');
