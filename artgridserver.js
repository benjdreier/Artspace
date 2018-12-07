var WebSocketServer = require('websocket').server;
var http = require('http');
var static = require('node-static');
const { Client } = require('pg');
var Jimp = require('jimp');
//const express = require('express');
var HttpDispatcher = require('httpdispatcher');
var dispatcher = new HttpDispatcher();
var fs = require('fs');

const client = new Client({
	connectionString: process.env.DATABASE_URL,
	ssl: true
});
console.log("Database URL:");
console.log(process.env.DATABASE_URL);

client.connect();

var clients = {};
var count = 0;

var grid_data;

client.query("SELECT grid_data FROM grids ORDER BY timestamp DESC", (err, res) => {
	console.log("Grid data loaded from Postgres");
	if (err) throw err;
	if(res.rows[0]["grid_data"][0]){
		grid_data = res.rows[0]["grid_data"];
	}
});

// Every 10 minutes, update the database w/ grid information
const DB_UPDATE_INTERVAL = 600000;
setInterval(updateDB, DB_UPDATE_INTERVAL);

// Every 10 seconds, update all users with grid information
// const GRID_UPDATE_INTERVAL = 10000;
// setInterval(sendGrid, GRID_UPDATE_INTERVAL);


let port = process.env.PORT || 8000;
var file = new static.Server();

var server = http.createServer(function(request, response) {
	// Handle http requests
	console.log(request.url);

	// Yikes ok this is awful. I would use express for routing but I have to handle http requests and websockets on the same port and I couldn't make websocket endpoints work with express. So I have to route with the stock http server, and I couldn't find a better way than this to make / route to my index file but have nothing else be affected. I tried many ways and this is the only way that worked. Next time maybe i'd start building the server with express, but at this point this is good enough. even though it kind of defeats the purpose of the router in the first place. It works given the time constraint.
	if(request.url == "/"){
		try {
			dispatcher.dispatch(request, response);
		}
		catch(err){
			console.log(err);
		}
	}
	else if(request.url == "/export"){
		exportGrid(function(){
			fs.readFile('grids/test.png', function(err, content){
				if (err) {
	                response.writeHead(400, {'Content-type':'text/html'})
	                console.log(err);
	                response.end("No such file");    
	            } 
	            else {
	                response.setHeader('Content-disposition', 'attachment; filename='+"artspace.png");
	                response.end(content);
	            }
			});
		});
	}
	else{
		request.addListener('end', function() {
			file.serve(request, response);
		}).resume();
	}
});

dispatcher.onGet("/", function(req, res) {
	file.serveFile("/artgrid.html", 200, {}, req, res);
	
});
dispatcher.onError(function(req, res) {
    res.writeHead(403);
    res.end("Error, the URL doesn't exist");
});

server.listen(port, function() {
	console.log((new Date()) + "Server is listening on port " + port);
});

wsServer = new WebSocketServer({
	httpServer: server
});

function updateClients(){
	for (var i in clients) {
		clientJson = JSON.stringify({
			type: "clients",
			number: clients.length
		});
		clients[i].sendUTF(clientJson);
	}
}

function exportGrid(download){
	console.log("Exporting Grid...");
	// Use Jimp to render a png pixel-by-pixel
	let image = new Jimp(grid_data[0].length, grid_data.length, function(err, image){
		if (err) throw err;
		grid_data.forEach((row, y) => {
			row.forEach((colorString, x) => {
				image.setPixelColor(strToHex(colorString), x, y);
			});
		});
		image.write('grids/test.png', (err) => {
			console.log("Done.");
			download();
			if (err) throw err;
		});
	});

	// little helper function to get the right hex value
	function strToHex(str){
		// Just in case it tries to render an old version of the grid 
		if(str == 1){
			return 0x000000ff;
		}
		if(str == 0) return 0xffffffff;
		if(!str) return 0xffffffff;
		// Splice off the first # char, add a 100% alpha channel, then parse as a hexadecimal int.
		return parseInt(str.substring(1)+"FF", 16);
	}
}

wsServer.on('request', function(request) {
	console.log("Connection from origin " + request.origin);
	var connection = request.accept(null, request.origin);
	var id = count++;
	clients[id] = connection;
	console.log("Connection accepted with id ", id);

	//Send the grid automatically on connection
	let gridJson = JSON.stringify({type: "grid", grid: grid_data});
	connection.sendUTF(gridJson);

	//Also send new number of clients
	updateClients();

	//Handle user communication
	connection.on('message', function(message){
		//process websocket message
		var json = JSON.parse(message.utf8Data);

		if(json.type == "cellUpdate"){
			// Update the grid in server memory
			// TODO: validate
			grid_data[json.y][json.x] = json.value;

			//broadcast the same message to all clients
			for (var i in clients) {
				clients[i].sendUTF(JSON.stringify(json));
			}

			// Or try just sending the whole grid back
			// sendGrid();
		}
		else if(json.type == "message"){
			// For debugging
			console.log("Message received:");
			console.log(json.message);
		}
		else{
			console.log("Unexpected json type:");
			console.log(json.type);
			return;
		}

	});

	connection.on('close', function(connection) {
		console.log("Disconnection from ", connection);
		// let json = JSON.stringify({"type": "message", "message": "YOU DISCONNECTED"});
		// connection.sendUTF(json);
		// get rid of client
		//clients.splice(clients.indexOf(connection), 1);
		//updateClients();
		console.log("With ID:", id);
		delete clients[id];
	});
});

// This doesn't ever happen. TODO: Figure out how to exit gracefully
wsServer.on("SIGTERM", function(){
	console.log("We're exiting now!");
	updateDB();
});

function sendGrid(){
	let json = JSON.stringify({type: "grid", grid: grid_data});
	//broadcast the grid to all clients
	for (var i in clients) {
		clients[i].sendUTF(json);
	}
}

function updateDB(){
	console.log("Updating database...");
	client.query("INSERT INTO grids (grid_data) VALUES (\'"+JSON.stringify(grid_data)+"\');", (err, res) => {
		if (err){
			console.log("Database could not be update.")
		} 
		else{
			console.log("Done.");
		}
	});
}