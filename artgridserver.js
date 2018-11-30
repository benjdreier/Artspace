var WebSocketServer = require('websocket').server;
var http = require('http');
var static = require('node-static');
const { Client } = require('pg');

const client = new Client({
	connectionString: process.env.DATABASE_URL,
	ssl: true,
});
console.log(process.env.DATABASE_URL);

client.connect();

client.query('SELECT * FROM herokutable;', (err, res) => {
	if (err) throw err;
	for (let row of res.rows) {
		console.log(JSON.stringify(row));
	}
	client.end();
});


var clients = [];

//This is where the grid will live. It should recall the configuration
//from some database eventually, instead, of blanking it out with each
//refresh.
var grid_data = new Array(100);
for (var i = 0; i < grid_data.length; i++) {
	grid_data[i] = new Array(100);
}


// var grid_data = [[0,0,0,0,0,0],
// 				 [0,1,0,0,1,0],
// 				 [0,0,0,0,0,0],
// 				 [0,1,0,0,1,0],
// 				 [0,0,1,1,0,0],
// 				 [0,0,0,0,0,0],]

let port = process.env.PORT || 8000;
var file = new static.Server();

var server = http.createServer(function(request, response) {
	//not an http server so we don't care, i guess
	request.addListener('end', function() {
		file.serve(request, response);
	}).resume();
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
		}
		else{
			console.log("Unexpected json type");
			return;
		}

		let gridJson = JSON.stringify({type: "grid", grid: grid_data});
		//broadcast the message
		for (var i=0; i<clients.length; i++) {
			clients[i].sendUTF(gridJson);//the message//);
		}

	});

	connection.on('close', function(connection) {
		console.log("disconnection");
		// get rid of client
		clients.splice(clients.indexOf(connection), 1);
		updateClients();
	});
});