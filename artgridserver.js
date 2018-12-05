var WebSocketServer = require('websocket').server;
var http = require('http');
var static = require('node-static');
const { Client } = require('pg');
var Jimp = require('jimp');
const express = require('express');
//const app = express();
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

// client.query('SELECT grid_data FROM grids WHERE id=0;', (err, res) => {
// 	if (err) throw err;
// 	console.log("Selected ")
// 	for (let row of res.rows) {
// 		console.log(JSON.stringify(row));
// 	}
// 	client.end();
// });


var clients = [];

// var grid_data = new Array(300);
// for (var i = 0; i < grid_data.length; i++) {
// 	grid_data[i] = new Array(300);
// 	for (var j = 0; j < grid_data[0].length; j++) {
// 		grid_data[i][j] = "#FFFFFF";
// 	}
// }
// updateDB();
// return;

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

	// Yikes ok this is awful. I would use express for routing but I have to handle http requests and websockets on the same port and I couldn't make websocket endpoints work with express. So I have to route with the stock http server, and I couldn't find a better way than this to make / route to my index file but have nothing else be affected. I tried many ways and this is the only way that worked. Next time maybe i'd start building the server with express, but at this point this is good enough. even though it kind of defeats the purpose of the router in the first place. It works.
	if(request.url == "/"){
		console.log("this is it");
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
			//res.download("grids/test.png");
		});
	}
	else{
		console.log("that aint it");
		request.addListener('end', function() {
			file.serve(request, response);
		}).resume();
	}
});

dispatcher.onGet("/", function(req, res) {
	console.log("goin to the index!");
	// file.serveFile("/public/style.css", 200, {}, req, res);
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
	for (var i=0; i<clients.length; i++) {
		clientJson = JSON.stringify({
			type: "clients",
			number: clients.length
		});
		clients[i].sendUTF(clientJson);
	}
}

function exportGrid(download){
	// Assuming 8 colors max
	let image = new Jimp(grid_data[0].length, grid_data.length, function(err, image){
		if (err) throw err;
		grid_data.forEach((row, y) => {
			row.forEach((colorString, x) => {
				console.log("str: "+colorString);
				console.log("hex: "+strToHex(colorString));
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
		if(str == 1){
			return 0x000000ff;
		}
		if(str == 0) return 0xffffffff;
		if(!str) return 0xffffffff;
		// Splice off the first #, then parse as a hexadecimal int.
		return parseInt(str.substring(1)+"FF", 16);
	}
}

wsServer.on('request', function(request) {
	console.log("Connection from origin " + request.origin);
	var connection = request.accept(null, request.origin);
	var index = clients.push(connection) - 1;

	//Send the grid automatically on connection
	let gridJson = JSON.stringify({type: "grid", grid: grid_data});
	connection.sendUTF(gridJson);

	//Also send new number (for now) of clients
	updateClients();

	//Handle user communication
	connection.on('message', function(message){
		//process websocket message
		console.log("JSON RECIEVED: ");
		console.log(message);
		var json = JSON.parse(message.utf8Data);
		console.log(json);

		if(json.type == "cellUpdate"){
			// Update the grid in server memory
			// TODO: validate
			
			grid_data[json.y][json.x] = json.value;
			broadcast the same message to all clients
			for (var i=0; i<clients.length; i++) {
				clients[i].sendUTF(JSON.stringify(json));
			}

			// Or try just sending the whole grid back
			//sendGrid();
		}
		else if(json.type == "message"){
			console.log(json.message);
		}
		else{
			console.log("Unexpected json type");
			console.log(json.type);
			return;
		}

	});

	connection.on('close', function(connection) {
		console.log("disconnection");
		// get rid of client
		clients.splice(clients.indexOf(connection), 1);
		updateClients();
	});
});

wsServer.on("SIGTERM", function(){
	console.log("We're exiting now!");
	updateDB();
});

function sendGrid(){
	let json = JSON.stringify({type: "grid", grid: grid_data});
	//broadcast the same message to all clients
	for (var i=0; i<clients.length; i++) {
		clients[i].sendUTF(json);
	}
}

function updateDB(){
	console.log("Updating database...");
	//console.log("INSERT INTO grids (grid_data) VALUES (\'"+JSON.stringify(grid_data)+"\');");
	client.query("INSERT INTO grids (grid_data) VALUES (\'"+JSON.stringify(grid_data)+"\');", (err, res) => {
		if (err){
			console.log("db could not be update.")
			//throw err;
		} 
		else{
			console.log("Done.");
		}
	});
}