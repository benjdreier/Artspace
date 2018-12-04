// This is in the index / directory.
// This will all only be executed after the page is loaded
$(function () {

c = document.getElementById("canvas");
ctx = c.getContext('2d');

c.width = document.body.clientWidth;
c.height = document.body.clientHeight;

window.addEventListener('resize', function(e){
	c.width = document.body.clientWidth;
	c.height = document.body.clientHeight;
	drawGrid();
});

var canvasRect = canvas.getBoundingClientRect();
var mouseDown = false;
var clickedPoint = {x:0, y:0};

// This is the point in gridspace that appears at the top-left
// corner of the screen.
// By default, place the user right in the middle of the grid. So they know what's going on. 
var origin = {x:6600, y:6600};
// Default pizel size
let DEFAULT_SIZE = 100;
// Default zoom level
var zoom = -1;

let MAX_ZOOM = 2;
let MIN_ZOOM = -4;
let scale = function(){return Math.pow(2, zoom);}

// This seems safe. maybe.
let MODES = ["Move", "Draw"];
var mode = 0;

var brushColor = "#000000";
let COLORS = ["#000000", "#0000FF", "#FF0000", "#00FF00"];
let DEFAULT_COLOR = "#FFFFFF";

var colorButtons = document.getElementsByClassName("button-color");
for(var i=0; i<colorButtons.length; i++){
	let button = colorButtons[i];
	let color=i;
	button.addEventListener("click", function(){
		brushColor = COLORS[color];
		console.log("Updated brush color");
		console.log(brushColor);
	});
}

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

// Connection via heroku
var connection = new WebSocket('wss://damp-savannah-54651.herokuapp.com');

// TEST CONNECTION
if(!connection){
	connection = new WebSocket('ws://localhost:8000');
}
console.log("connection: ", connection);

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
			console.log("Brush: "+brushColor);
			console.log("Point: "+grid[iY][iX]);
			// If trying to apply the same color, clear it.
			var newValue;
			if(grid[iY][iX] == brushColor){
				console.log("same!");
				newValue = DEFAULT_COLOR;
			} 
			else{
				console.log("different!");
				newValue = brushColor;
			}
			console.log("New: "+newValue);
			updateGrid(grid, iX, iY, newValue);
		}
		drawGrid();
	}
});
canvas.addEventListener('mouseup', function(e){
	mouseDown = false;
});
canvas.addEventListener('mousemove', function(e){
	console.log(mouseDown);
	if(MODES[mode] == "Move" && mouseDown){
		console.log(e.movementX);
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
	if(e.code == "Space"){
		// Cycle modes
		mode = (mode + 1) % MODES.length;
		drawGrid();
	}
})

// Handle mobile touch events
// http://bencentra.com/code/2014/12/05/html5-canvas-touch-events.html

var touchPosits = {};

canvas.addEventListener("touchstart", function(e){
	e.preventDefault();
	// The latest touch
	var touch = e.touches[e.touches.length-1];

	// Add this touch to the list of all touch positions
	touchPosits[touch.identifier] = {x: touch.clientX, y: touch.clientY};
	
	var mouseEvent = new MouseEvent("mousedown", {
		clientX: touch.clientX,
		clientY: touch.clientY
	});
	canvas.dispatchEvent(mouseEvent);
}, false);

canvas.addEventListener("touchmove", function(e){
	e.preventDefault();
	if(e.touches.length == 1){
		console.log("One touch down");
		// Move the canvas
		var touch = e.touches[0];
		console.log("x: " + touch.clientX);
		let id = touch.identifier;

		var dX = touch.clientX - touchPosits[id].x;
		var dY = touch.clientY - touchPosits[id].y;
		touchPosits[id].x = touch.clientX;
		touchPosits[id].y = touch.clientY;

		var moveEvent = new MouseEvent("mousemove", {
			movementX: dX,
			movementY: dY,
			clientX: touch.clientX,
			clientY: touch.clientY
		});
		canvas.dispatchEvent(moveEvent);
	}
	else if(e.touches.length > 1){
		console.log("Multiple touches");
		// Ok now let's attempt to Zoom. Let's do some math.
		// Just like... idk don't touch w/ 3 fingers please. 
		var touch1 = e.touches[0];
		var touch2 = e.touches[1];

		let id1 = touch1.identifier;
		let id2 = touch2.identifier;

		// Respective movements of touches in screen coords
		let vx1 = touch1.clientX - touchPosits[id1].x;
		let vy1 = touch1.clientY - touchPosits[id1].y;
		let vx2 = touch2.clientX - touchPosits[id2].x;
		let vy2 = touch2.clientY - touchPosits[id2].y;
		console.log("Touch 1 moved ", vx1, vy1);
		console.log("Touch 2 moved ", vx2, vy2);
		// Update last position
		touchPosits[id1].x = touch1.clientX;
		touchPosits[id1].y = touch1.clientY;
		touchPosits[id2].x = touch2.clientX;
		touchPosits[id2].y = touch2.clientY;

		// Displacement between touches in screen coords
		let dx1 = touch2.clientX - touch1.clientX;
		let dy1 = touch2.clientY - touch1.clientY;
		console.log("Displacement:", dx1, dy1);
		
		// Apply the effect from movement 1 and movement 2 in succession
		// Start with the first movement

		let distance1 = Math.sqrt(Math.pow(dx1, 2) + Math.pow(dy1, 2));
		// Unit vector at touch1 poiting to touch2
		let dux = dx1 / distance1;
		let duy = dy1 / distance1;

		// v1 dotted with -du to get the magnitude of the component of p1's movement in the direction away from p2
		let mvmtAway1 = (vx1 * (-1*dux)) + (vy1 * (-1*duy));
		let dscale1 = (mvmtAway1 / distance1) + 1;

		// Position of touch 2 in grid coords
		let pos2 = toGridCoords(touch2.clientX, touch2.clientY);

		// Zeeping point 2 fixed, zoom in.
		zoomIntoPoint(Math.log2(dscale1), pos2.x, pos2.y);

		// Now for the second one, we need the updated distance and position
		// du stays the same (I think)
		// Calulate new displacement
		let dx2 = dx1 + vx1;
		let dy2 = dy1 + vy1;
		let distance2 = Math.sqrt(Math.pow(dx2, 2) + Math.pow(dy2, 2));

		let mvmtAway2 = (vx2 * dux) + (vy2 * duy);
		let dscale2 = (mvmtAway2 / distance2) + 1;

		// Position of slightly moved touch 1 in grid coords
		let pos1 = toGridCoords(touch1.clientX + vx1, touch1.clientY + vy1);
		zoomIntoPoint(Math.log2(dscale2), pos1.x, pos1.y);

		// Sure hope this works.
		drawGrid();

	}
	
	// var json = JSON.stringify({type:"debug", message: e.touches});
	// console.log(json);

	// connection.send(json);
});

canvas.addEventListener("touchend", function(e){
	e.preventDefault();
	let touches = e.changedTouches;
	for(let i=0; i<touches.length; i++){
		delete touchPosits[touches[i].identifier];
	}
	var mouseEvent = new MouseEvent("mouseup", {});
  	canvas.dispatchEvent(mouseEvent);
})

canvas.addEventListener("touchtap", function(e){
	e.preventDefault();
	console.log(e);
	var touch = e.customData;
	let oldMode = mode;
	// Switch to drawing mode
	mode = 1;
	// Then send a mousedown event
	var mouseEvent = new MouseEvent("mousedown", {
		clientX: touch.touchX,
		clientY: touch.touchY
	});
	canvas.dispatchEvent(mouseEvent);
	// And then switch back
	mode = oldMode;
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
			ctx.fillStyle = grid[y][x];
			//legacy support
			if(grid[y][x] == 1){
				ctx.fillStyle = "#000000";
			}
			if(grid[y][x] == 0 || !grid[y][x]){
				ctx.fillStyle = "#FFFFFF";
			}
			ctx.fill();
		}
	}
	ctx.fillStyle="#000000";
	// Draw some informational stuff
	ctx.fillText("Users: " + currentUsers, 5, 15);
	ctx.fillText("Mode: " + MODES[mode], 5, 25);
}

// let exportButton = document.getElementById("button-export");
// exportButton.addEventListener("click", exportGrid);

// function exportGrid(){
// 	console.log("Requesting export....");
// 	var json = JSON.stringify({type:"export"});
// 	connection.send(json);
// }

function clear(){
	oldStyle = ctx.fillStyle;
	ctx.fillStyle = "white"; //background color
	ctx.fillRect(0,0,canvas.width,canvas.height);
	ctx.fillStyle = oldStyle;
}

});