var WebSocketServer = require('websocket').server;
var http = require('http');
var static = require('node-static');
const { Client } = require('pg');
var Jimp = require('jimp');
const express = require('express');
const app = express();

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

//This is where the grid will live. It should recall the configuration
//from some database eventually, instead, of blanking it out with each
//refresh.

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
	console.log("Here is that data u asked for!");
	if (err) throw err;
	if(res.rows[0]["grid_data"][0]){
		grid_data = res.rows[0]["grid_data"];
	}
	//console.log("tryna export....");
	//exportGrid();
});

// Every 10 minutes
const UPDATE_INTERVAL = 600000;

setInterval(updateDB, UPDATE_INTERVAL);

// var grid_data = [[0,0,0,0,0,0],
// 				 [0,1,0,0,1,0],
// 				 [0,0,0,0,0,0],
// 				 [0,1,0,0,1,0],
// 				 [0,0,1,1,0,0],
// 				 [0,0,0,0,0,0],]

let port = process.env.PORT || 8000;
//var file = new static.Server();

var server = http.createServer(function(request, response) {
	//not an http server so we don't care, i guess
	// request.addListener('end', function() {
	// 	file.serve(request, response);
	// }).resume();
});

server.listen(port, function() {
	console.log((new Date()) + "Server is listening on port " + port);
});

wsServer = new WebSocketServer({
	httpServer: server
});

app.use(express.static("grids"));
app.use(express.static("public"));

app.get('/', (req, res) => {
	res.sendfile(__dirname + '/artgrid.html');
});
app.get('/export', (req, res) => {
	exportGrid(function(){
		res.download("grids/test.png");
	});
})
app.listen(3000, function () {
	console.log("Express running on port 3000");
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

		if(json.type == "gridUpdate"){
			// Update the grid in server memory
			// TODO: validate
			
			grid_data[json.y][json.x] = json.value;
			let gridJson = JSON.stringify({type: "grid", grid: grid_data});
			//broadcast the message
			for (var i=0; i<clients.length; i++) {
				clients[i].sendUTF(gridJson);//the message//);
			}
		}
		else if(json.type == "export"){
			//exportGrid();
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