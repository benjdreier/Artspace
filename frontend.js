// This will all only be executed after the page is loaded
$(function () {

c = document.getElementById("canvas");
ctx = c.getContext('2d');
var canvasRect = canvas.getBoundingClientRect();
var mouseDown = false;
var clickedPoint = {x:0, y:0};
// This is the point in gridspace that appears at the top-left
// corner of the screen.
// By default, i'll set it roughly in the middle of a 100x100 grid
var origin = {x:2200, y:2200};
// Default pizel size
let DEFAULT_SIZE = 100;
// Default zoom level
var zoom = -1;

// Change in a sec
let MAX_ZOOM = 2;
let MIN_ZOOM = -4;
let scale = function(){return Math.pow(2, zoom);}
// Not sure how to implement this yet. This seems safe. maybe.
// This array is really just a formality but will be good when
// we want to display the mode user-friendily (?).
let MODES = ["Move", "Draw"];
var mode = 0;
var grid;

// Number of active users
var currentUsers = 0;

// Do initial websocket stuff

// if user is running mozilla then use it's built-in WebSocket
window.WebSocket = window.WebSocket || window.MozWebSocket;
// if browser doesn't support WebSocket, just show
// some notification and exit
if (!window.WebSocket) {
	content.html($('<p>',
	  { text:'Sorry, but your browser doesn\'t support WebSocket.'}
	));
	input.hide();
	$('span').hide();
	return;
}

// open connection
// fucko
//let port = process.env.PORT || 8000;

// Connection via heroku
var connection = new WebSocket('wss://damp-savannah-54651.herokuapp.com');

// TEST CONNECTION
if(!connection){
	connection = new WebSocket('ws://localhost:8000');
}

connection.onopen = function(){
	// Some stuff
};

connection.onerror = function(error){
	// just in there were some problems with connection...
	// TODO: Make this good
	alert('Sorry, but there\'s some problem with your '
		+ 'connection or the server is down.');
};

connection.onmessage = function(message){
	// Handle incoming messages from the server
	// For now, these will be JSON objects just 
	// containing an updated grid
	try {
    	var json = JSON.parse(message.data);
    } 
    catch (e) {
    	console.log('Invalid JSON: ', message.data);
    	return;
    }
    if(json.type == "grid"){
    	grid = json.grid;
    	drawGrid();
    }
    else if(json.type == "clients"){
    	console.log("Client update");
    	console.log(json);
    	currentUsers = json.number;
    	drawGrid();
    }
}




canvas.addEventListener('mousedown', function(e){
	mouseDown = true;
	if(MODES[mode] == "Draw"){
		gridCoords = toGridCoords(e.clientX, e.clientY);
		iX = Math.floor(gridCoords.x / DEFAULT_SIZE);
		iY = Math.floor(gridCoords.y / DEFAULT_SIZE);
		console.log(iX, iY);
		if(iY>=0 && iY<grid.length){
			updateGrid(grid, iX, iY, 1-grid[iY][iX]);
		}
		drawGrid();
	}
});
window.addEventListener('mouseup', function(e){
	mouseDown = false;
});
window.addEventListener('mousemove', function(e){
	gridCoords = toGridCoords(e.clientX, e.clientY);
	if(MODES[mode] == "Move" && mouseDown){
		//drag the canvas center
		dx = e.movementX;
		dy = e.movementY;

		origin.x -= dx;
		origin.y -= dy;

		drawGrid();
	}
});
canvas.addEventListener("wheel", function(e){
	zoomIntoPoint(-1*e.deltaY/300, e.clientX, e.clientY);
	drawGrid();
	// Prevent whole page from scrolling
	e.preventDefault();
}, false);
window.addEventListener("keydown", function(e){
	// Space bar
	console.log(e);
	if(e.code == "Space"){
		// Cycle modes
		mode = (mode + 1) % MODES.length;
		drawGrid();
	}
})

function updateGrid(grid, x, y, value){
	grid[y][x] = value;

	var json = JSON.stringify({type:"gridUpdate", x: x, y: y, value: value});
	console.log(json);

	connection.send(json);
}

function zoomIntoPoint(amount, pX, pY){
	// Don't if you'll be overzooming
	// But allows for fixing
	if((amount>0 && zoom+amount>MAX_ZOOM) || (amount<0 && zoom+amount<MIN_ZOOM)) return;

	preGridCoords = toGridCoords(pX, pY);
	zoom += amount;
	dScale = Math.pow(2, amount);
	console.log("zoom: ", zoom);
	postGridCoords = toGridCoords(pX, pY);

	// adjust origin to preserve fixed point

	origin.x -= (postGridCoords.x - preGridCoords.x) * scale();
	origin.y -= (postGridCoords.y - preGridCoords.y) * scale();
}

function toGridCoords(domX, domY){
	// Might want to get this earlier
	cX = domX - canvasRect.left;
	cY = domY - canvasRect.top;
	return {x: (cX + origin.x)/scale(), y: (cY + origin.y)/scale()};
}

function drawGrid(){
	clear();

	// Higher zoom levels will make the squares bigger
	let squareSize = DEFAULT_SIZE * scale();

	// Calculate array bounds so it doesn't iterate over the whole
	// grid needlessly

	// Bounding box of the screen
	let leftBound = origin.x;
	let rightBound = origin.x + canvas.width;
	let topBound = origin.y;
	let bottomBound = origin.y + canvas.height;
	console.log("Screen bounds: ", leftBound, rightBound, topBound, bottomBound);

	// Assume grid starts in the top left, we can adjust
	// the default center to make it appear centered
	var leftIndex = Math.floor(leftBound / squareSize);
	var rightIndex = Math.floor(rightBound / squareSize);
	var topIndex = Math.floor(topBound / squareSize);
	var bottomIndex = Math.floor(bottomBound / squareSize);

	//adjust so indices don't overflow
	leftIndex = Math.max(leftIndex, 0);
	topIndex = Math.max(topIndex, 0);
	rightIndex = Math.min(rightIndex, grid[0].length-1);
	bottomIndex = Math.min(bottomIndex, grid.length-1);


	console.log(leftIndex, rightIndex, topIndex, bottomIndex);

	// Now that those are calculated, iterate through the subset
	// of grid and draw it. 
	ctx.lineWidth = 0.5;

	for(let y=topIndex; y<=bottomIndex; y++){
		for(let x=leftIndex; x<=rightIndex; x++){
	//for(let y=0; y<grid.length; y++){
		//for(let x=0; x<grid[0].length; x++){
			//draw grid square
			ctx.beginPath();
			let cornerX = x*squareSize-origin.x;
			let cornerY = y*squareSize-origin.y;
			ctx.moveTo(cornerX, cornerY);
			ctx.lineTo(cornerX+squareSize, cornerY);
			ctx.lineTo(cornerX+squareSize, cornerY+squareSize);
			ctx.lineTo(cornerX, cornerY+squareSize);
			ctx.closePath();
			// Draw gridline
			ctx.stroke();
			// Fill square
			if(grid[y][x] == 1){
				ctx.fill();
			}
		}
	}

	// Draw some informational stuff
	ctx.fillText("Users: " + currentUsers, 5, 15);
	ctx.fillText("Mode: " + MODES[mode], 5, 25);
}

function clear(){
	oldStyle = ctx.fillStyle;
	ctx.fillStyle = "white"; //background color
	ctx.fillRect(0,0,canvas.width,canvas.height);
	ctx.fillStyle = oldStyle;
}

});