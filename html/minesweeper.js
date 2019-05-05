function shuffle(a) {
    var j, x, i;
    for (i = a.length - 1; i > 0; i--) {
        j = Math.floor(Math.random() * (i + 1));
        x = a[i];
        a[i] = a[j];
        a[j] = x;
    }
    return a;
}

class Board {
	constructor(width, height, num_bombs) {
		this.width = width;
		this.height = height;
		this.num_bombs = num_bombs;
		this.tiles = [];
		this.status = "start";
		this.bombs_left = this.num_bombs;
		this.tiles_left = this.width * this.height - this.num_bombs;
		this.init_tiles();
		this.reveal_history = []
		this.flag_history = []

	}

	init_tiles() {
		for (var i = 0; i < this.width * this.height; i++) {
			this.tiles.push(new Tile(i));
		}
	}

	radius(index) {
		var col = index % this.width;
		var row = Math.floor(index / this.width);

		var first_row = Math.max(0, row - 1);
		var last_row = Math.min(this.height - 1, row + 1);

		var first_col = Math.max(0, col - 1);
		var last_col = Math.min(this.width - 1, col + 1);

		var result = []

		for (var r = first_row; r <= last_row; r++) {
			for (var c = first_col; c <= last_col; c++) {
				var i = this.width * r + c;
				if (i != index) {
					result.push(this.tiles[i]);
				}
			}
		}

		return result;
	}

	assign_bombs() {
		var indices = [];
		for (var i = 0; i < this.width * this.height; i++) {
			indices.push(i);
		}
		shuffle(indices);
		for (var i = 0; i < this.num_bombs; i++) {
			var index = indices[i];
			var tile = this.tiles[index];
			tile.make_bomb();
			for (var tile of this.radius(index)) {
				tile.number += 1;
			}
		}
	}

	assign_bombs_with_indices(indices) {
		for (var i = 0; i < this.num_bombs; i++) {
			var index = indices[i];
			var tile = this.tiles[index];
			tile.make_bomb();
			for (var tile of this.radius(index)) {
				tile.number += 1;
			}
		}
	}

	assign_bombs_with_zero(index) {
		var indices = [];
		var to_exclude = {};
		to_exclude[index] = true;
		for (var tile of this.radius(index)) {
			to_exclude[tile.index] = true;
		}
		for (var i = 0; i < this.width * this.height; i++) {
			if (!to_exclude[i]) {
				indices.push(i);
			}
		}
		shuffle(indices);
		for (var i = 0; i < this.num_bombs; i++) {
			var index = indices[i];
			var tile = this.tiles[index];
			tile.make_bomb();
			for (var tile of this.radius(index)) {
				tile.number += 1;
			}
		}
	}
	

	covered_radius(index) {
		var col = index % this.width;
		var row = Math.floor(index / this.width);

		var first_row = Math.max(0, row - 1);
		var last_row = Math.min(this.height - 1, row + 1);

		var first_col = Math.max(0, col - 1);
		var last_col = Math.min(this.width - 1, col + 1);

		var result = []

		for (var r = first_row; r <= last_row; r++) {
			for (var c = first_col; c <= last_col; c++) {
				var i = this.width * r + c;
				var tile = this.tiles[i];
				if (i != index && tile.is_covered) {
					result.push(tile);
				}
			}
		}

		return result;
	}

	reveal(index) {
		var revealed_tile = this.tiles[index];
		if (!revealed_tile.is_covered || revealed_tile.is_flagged) {
			return;
		}
		revealed_tile.reveal();
		this.reveal_history.push(index)
		if (revealed_tile.is_bomb) {
			this.status = "lose";
			this.bombs_left -= 1;
			return;
		}
		else {
			this.tiles_left -= 1;
		}
		if (revealed_tile.number == 0) {
			var to_reveal = [revealed_tile]
			while(to_reveal.length > 0) {
				// I rewrote radius here because SPEED IS EVERYTHING, COPYPASTA IS EVERYTHING
				var next = to_reveal.pop();
				var next_index = next.index;
				var col = next_index % this.width;
				var row = Math.floor(next_index / this.width);
				var first_row = Math.max(0, row - 1);
				var last_row = Math.min(this.height - 1, row + 1);		
				var first_col = Math.max(0, col - 1);
				var last_col = Math.min(this.width - 1, col + 1);
				for (var r = first_row; r <= last_row; r++) {
					for (var c = first_col; c <= last_col; c++) {
						var i = this.width * r + c;
						var tile = this.tiles[i]
						if (tile.is_covered && !tile.is_flagged) {
							if (tile.number == 0) {
								to_reveal.push(tile);
							}
							tile.reveal();
							this.reveal_history.push(tile.index)
							this.tiles_left -= 1;
						}
					}
				} 
			}
		}
	}

	

	chord(index) {
		var chord_tile = this.tiles[index];
		if (chord_tile.is_covered || chord_tile.is_bomb) {
			return;
		}
		var col = index % this.width;
		var row = Math.floor(index / this.width);

		var first_row = Math.max(0, row - 1);
		var last_row = Math.min(this.height - 1, row + 1);

		var first_col = Math.max(0, col - 1);
		var last_col = Math.min(this.width - 1, col + 1);

		var to_reveal = []
		var num_flagged = 0;

		for (var r = first_row; r <= last_row; r++) {
			for (var c = first_col; c <= last_col; c++) {
				var i = this.width * r + c;
				if (i != index) {
					var tile = this.tiles[i];
					if (tile.is_flagged || (tile.is_bomb && !tile.is_covered)) {
						num_flagged += 1;
					}
					else if (tile.is_covered) {
						to_reveal.push(tile);
					}
				}
			}
		}
		if (num_flagged == chord_tile.number) {
			for (var tile of to_reveal) {
				this.reveal(tile.index);
			}
		}
	}

	

	flag(index) {
		var tile = this.tiles[index];
		if (!tile.is_covered) {
			return;
		}
		if (tile.is_flagged) {
			tile.unflag();
			this.bombs_left += 1;
		}
		else {
			tile.flag();
			if (tile.is_bomb) {
				this.flag_history.push(tile.index)
			}
			this.bombs_left -= 1;
		}
	}

	

	toString() {
		var result = "";
		for (var r = 0; r < this.height; r++) {
			for (var c = 0; c < this.width; c++) {
				var i = this.width * r + c;
				var tile = this.tiles[i];
				if (tile.is_covered) {
					result += " ";
				}
				else {
					result += tile.number.toString();
				}
			}
			result += "\n";
		}
		return result;
	}

	render(ctx, tile_size, colors) {
		for (var r = 0; r < this.height; r++) {
			for (var c = 0; c < this.width; c++) {
				var x = tile_size * c;
				var y = tile_size * r;
				var index = this.width * r + c;
				var tile = this.tiles[index];
				this.draw_tile(tile, ctx, tile_size, x, y, colors);
			}
		}
	}
	//Lots of parameters for this function. First 3 are standard.
	//Row and Col are the starting row and col of the upper-left tile in the region.
	//width and height are the number of cells to draw in the region
	//x and y denote where to draw the upper left cell. Note that these usually will be negative (a bit cut off).
	render_region(ctx, tile_size, colors, row, col, width, height, x, y) {
		for (var r = 0; r <  height; r++) {
			for (var c = 0; c < width; c++) {
				var current_row = row + r;
				var current_col = col + c;
				var index = this.width * current_row + current_col;
				var tile = this.tiles[index];
				var tile_x = tile_size * c + x;
				var tile_y = tile_size * r + y;
				this.draw_tile(tile, ctx, tile_size, tile_x, tile_y, colors);

			}
		}
	}

	draw_number(tile, ctx, tile_size, x, y, colors) {
		ctx.drawImage(colors[tile.number], x, y);
	}

	draw_tile(tile, ctx, tile_size, x, y, colors) {
		if (tile.is_covered) {
			if (tile.is_flagged) {
				ctx.drawImage(colors[11], x, y);
			}
			else {
				ctx.drawImage(colors[10], x, y);
			}		
		}
		else if (tile.is_bomb) {
			ctx.drawImage(colors[0], x, y);
			ctx.drawImage(colors[9], x, y);
		}
		else {
			this.draw_number(tile, ctx, tile_size, x, y, colors);
		}
	}



}

class Tile {
	constructor(index) {
		this.is_bomb = false;
		this.index = index;
		this.is_covered = true;
		this.number = 0;
		this.is_flagged = false;
	}

	reveal() {
		this.is_covered = false;
	}

	make_bomb() {
		this.is_bomb = true;
	}

	assign_number(number) {
		this.number = number;
	}

	flag() {
		this.is_flagged = true;
	}

	unflag() {
		this.is_flagged = false;
	}

	toString() {
		return this.index.toString();
	}
}

class Minimap {
	constructor(gui) {
		this.gui = gui
		this.board = this.gui.board
		this.width = 250
		this.height = 250
		this.canvas = document.getElementById("minimap")
		this.background_minimap = document.createElement('canvas');
		this.background_minimap.width = 250
		this.background_minimap.height = 250
		this.background_minimap_ctx = this.background_minimap.getContext("2d");
		this.region_width = Math.floor(this.board.width / this.width)
		this.region_height = Math.floor(this.board.height / this.height)
		this.tiles_per_region =  this.region_width * this.region_height
		this.region_counts = []
		this.init_counts()
		this.init_background_minimap()
		this.dragging = false
		
	}

	init_counts() {
		for (var r = 0; r < this.height; r++) {
			for (var c = 0; c < this.width; c++) {
				this.region_counts.push(this.tiles_per_region)
			}
		}
	}

	get_region_index(tile_index) {
		var x = Math.floor(tile_index % this.board.width)
		var y = Math.floor(tile_index / this.board.height)
		var region_x = Math.floor(x / this.region_width)
		var region_y = Math.floor(y / this.region_height)
		return region_y * this.width + region_x
	}

	update_region(tile_index) {
		var region_index = this.get_region_index(tile_index)
		this.region_counts[region_index] -= 1
		this.draw_region(region_index)
	}

	get_color(region_count) {		
		if (region_count == this.tiles_per_region) {
			return "#808080"
		}
		else if (region_count == 0) {
			return "#00ff00"
		}
		else {
			return "#ffff00"
		}
	}

	on_click(event) {
		console.log("I was called...")
		this.dragging = true
		this.change_position(event)
	}

	on_mouse_move(event) {
		if (!this.dragging) {
			return false
		} 
		else {
			this.change_position(event)
		}
	}

	change_position(event) {
		var rect = this.canvas.getBoundingClientRect();
    	var x = event.clientX - rect.left
    	var y = event.clientY - rect.top 
    	if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
    		return
    	}
    	this.gui.current_x = this.gui.tile_size * this.region_width * x
    	this.gui.current_y = this.gui.tile_size * this.region_height * y
    	window.requestAnimationFrame(() => this.gui.render_region());
	}

	draw_region(region_index) {
		var region_count = this.region_counts[region_index]
		var region_x = Math.floor(region_index % this.width)
		var region_y = Math.floor(region_index / this.width)
		this.background_minimap_ctx.fillStyle = this.get_color(region_count)

		this.background_minimap_ctx.fillRect(region_x, region_y, 1, 1)
	}

	init_background_minimap() {
		this.background_minimap_ctx.fillStyle = "#808080"
		this.background_minimap_ctx.fillRect(0,0,this.width,this.height)
	}

	render() {
		var ctx = this.canvas.getContext("2d");
		ctx.drawImage(this.background_minimap, 0, 0)
		var mini_pos_x = Math.floor(this.gui.current_x / (this.region_width * this.gui.tile_size))
		var mini_pos_y = Math.floor(this.gui.current_y / ( this.region_height * this.gui.tile_size))
		var mini_width_length = Math.floor(this.gui.window_width / this.region_width)
		var mini_height_length = Math.floor(this.gui.window_height / this.region_height)
		ctx.strokeStyle = "#ff0000"
		ctx.strokeRect(mini_pos_x, mini_pos_y, mini_width_length, mini_height_length)
	}
}

class Gui {
	constructor() {
		this.canvas = document.getElementById("myCanvas");
		var width = 0;
		var height = 0;
		var num_bombs = 0;
		var tile_size = parseInt(document.getElementById("tile_size").value, 10);
		//this.board = new Board(width, height, num_bombs);
		this.tile_size = tile_size;
		this.first_click = true;
		this.current_x = 0;
		this.current_y = 0;
		this.window_width = 50;
		this.window_height = 25;
		this.is_dragging = false;
		this.anchor_x = 0;
		this.anchor_y = 0;
		this.prev_x = 0;
		this.prev_y = 0;
		this.resize();
		this.cursor_x = 0;
		this.cursor_y = 0;
		this.reveal_index = 0;
		this.flag_index = 0;
	}

	async load_board() {
		var json_data = await fetch("/board")
		var board_data = await json_data.json()
		this.width = board_data["Width"]
		this.height = board_data["Height"]
		this.num_bombs = board_data["Bombs"].length
		this.board = new Board(this.width, this.height, this.num_bombs)
		this.board.assign_bombs_with_indices(board_data["Bombs"])
		this.minimap = new Minimap(this)
	} 

	load_image(image_path) {
		const image = new Image();
		var offscreenCanvas = document.createElement('canvas');
		offscreenCanvas.width = this.tile_size ;
		offscreenCanvas.height = this.tile_size;
		var ctx = offscreenCanvas.getContext("2d", { alpha: false });
		var tile_size = this.tile_size
		function on_load() {
			ctx.drawImage(image, 0, 0, tile_size, tile_size)
			return offscreenCanvas;
		}
		function make_promise(resolve, reject) {
			image.addEventListener('load', () => resolve(on_load()))
			image.src = image_path;
		}
		
		
		return new Promise(make_promise);
	}

	async load_images() {
		var images = []
		for (var i = 0; i <= 8; i++) {
			let file_path = "images/" + i.toString() + ".png"
			images.push(await this.load_image(file_path))
		}
		images.push(await this.load_image("images/bomb.png"))
		images.push(await this.load_image("images/facingDown.png"))
		images.push(await this.load_image("images/flagged.png"))
		this.colors = images;
	}

	async load_board_and_images() {
		await this.load_board()
		await this.load_images()
	}

	resize() {
		this.canvas.width = this.window_width * this.tile_size;
		this.canvas.height = this.window_height * this.tile_size;
	}

	render() {
		var ctx = this.canvas.getContext("2d", { alpha: false });
		this.board.render(ctx, this.tile_size, this.colors);
	}

	render_region() {
		//render_region(ctx, tile_size, colors, row, col, width, height, x, y) {
		var ctx = this.canvas.getContext("2d", { alpha: false });
		var row = Math.floor(this.current_y / this.tile_size);
		var col = Math.floor(this.current_x / this.tile_size);
		var x = this.tile_size * col - this.current_x;
		var y = this.tile_size * row - this.current_y;
		var width_to_draw = this.current_x >= this.tile_size * (this.board.width - this.window_width) ? this.window_width : this.window_width + 1;
		var height_to_draw = this.current_y >= this.tile_size * (this.board.height - this.window_height) ? this.window_height : this.window_height + 1;

		this.board.render_region(ctx, this.tile_size, this.colors, row, col, width_to_draw, height_to_draw, x, y)
		this.minimap.render()
	}

	on_click(event) {
		var rect = this.canvas.getBoundingClientRect();
    	var x = event.clientX - rect.left + this.current_x;
    	var y = event.clientY - rect.top + this.current_y;
		var row = Math.floor(y / this.tile_size);
		var col = Math.floor(x / this.tile_size);
		this.minimap.on_click(event)
		if (row >= this.board.height || row < 0 || col >= this.board.width || col < 0) {
			return;
		}
		else {
			var ctx = this.canvas.getContext("2d", { alpha: false });
			var button = event.which
			var index = row * this.board.width + col
			if (button == 1) {
				var clicked_tile = this.board.tiles[index];
				if (event.shiftKey || (!clicked_tile.is_covered && clicked_tile.number == 0)) {
					this.is_dragging = true;
					this.anchor_x = event.x;
					this.anchor_y = event.y;
					this.prev_x = this.current_x;
					this.prev_y = this.current_y;
					console.log("Dragging...")
					return;
				}
				if (this.first_click) {
					///this.board.assign_bombs_with_zero(index);
					this.start = new Date();
					this.first_click = false;
				}
				if (clicked_tile.is_covered) {
					this.board.reveal(index);
				}
				else {
					this.board.chord(index);
				}
				if (this.board.tiles_left == 0) {
					var now = new Date();
					var time = (now - this.start) / 1000;
					setTimeout("alert('time: " + time.toString() + "');", 1);
				}
			}
			else if (button == 3) {
				this.board.flag(index);
				console.log(this.board.bombs_left);
			}
		}
		window.requestAnimationFrame(() => this.render_region());
	}

	on_mouse_up(event) {
		this.is_dragging = false;
		this.minimap.dragging = false
	}

	on_mouse_move(event) {
		this.cursor_x = event.x;
		this.cursor_y = event.y;
		if (!this.is_dragging) {
			this.minimap.on_mouse_move(event)
			return;
		}
		var dx =  this.anchor_x - event.x;
		var dy = this.anchor_y - event.y;
		var new_x = this.prev_x + dx;
		var new_y = this.prev_y + dy;
		this.update_position(new_x, new_y)
	}

	update_position(new_x, new_y) {
		if (new_x >= 0 && new_x <= this.tile_size * (this.board.width - this.window_width)) {
			this.current_x = new_x;
		}
		if (new_y >= 0 && new_y <= this.tile_size * (this.board.height - this.window_height)) {
			this.current_y = new_y
		}
		window.requestAnimationFrame(() => this.render_region());
	}

	reset() {
		this.canvas = document.getElementById("myCanvas");
		var width = parseInt(document.getElementById("width").value, 10);
		var height = parseInt(document.getElementById("height").value, 10);
		var num_bombs = parseInt(document.getElementById("num_bombs").value, 10);
		var tile_size = parseInt(document.getElementById("tile_size").value, 10);
		this.board = new Board(width, height, num_bombs);
		var old_tile_size = this.tile_size;
		this.tile_size = tile_size;
		this.resize();
		this.first_click = true;
		this.current_x = 0;
		this.current_y = 0;
		this.window_width = this.window_width;;
		this.window_height = this.window_height;

		if (old_tile_size != this.tile_size) {
			gui.load_images().then(() => {gui.render() })
		}
		else{
			this.render_region();
		}
	}

	apply() {
		this.tile_size = parseInt(document.getElementById("tile_size").value, 10);
		this.resize();
		this.load_images().then(() => {window.requestAnimationFrame(() => this.render_region());})
		
	}

	on_key(event) {
		if (event.keyCode == 16) {
			return;
		}
		else if (event.keyCode == 65) {
			var new_x = this.current_x - 5 * this.tile_size;
			this.update_position(new_x, this.current_y)
		}
		else if (event.keyCode == 87) {
			var new_y = this.current_y - 5 * this.tile_size;
			this.update_position(this.current_x, new_y)
		}
		else if (event.keyCode == 68) {
			var new_x = this.current_x + 5 * this.tile_size;
			this.update_position(new_x, this.current_y)
		}
		else if (event.keyCode == 83) {
			var new_y = this.current_y + 5 * this.tile_size;
			this.update_position(this.current_x, new_y)
		}
		window.requestAnimationFrame(() => this.render_region());
	}

	send_data(conn) {
		var reveal_delta = this.board.reveal_history.length - this.reveal_index
		var flag_delta = this.board.flag_history.length - this.flag_index
		if (reveal_delta + flag_delta > 0) {
			var message = new Uint32Array(reveal_delta + flag_delta + 1)
			for (var i = this.reveal_index; i < this.board.reveal_history.length; i++) {
				message[i - this.reveal_index] = (this.board.reveal_history[i])
				this.minimap.update_region(this.board.reveal_history[i])
			}
			message[reveal_delta] = 1000000000
			for (var i = this.flag_index; i < this.board.flag_history.length; i++) {
				message[i - this.flag_index + reveal_delta + 1] = (this.board.flag_history[i])
				this.minimap.update_region(this.board.flag_history[i])
			}
			conn.send(message)
			this.reveal_index = this.board.reveal_history.length;
			this.flag_index = this.board.flag_history.length;
		}
	}

}



var gui = new Gui();
function start_listening() {
	document.addEventListener("mousedown", (event) => gui.on_click(event));
	document.addEventListener("keydown", (event) => gui.on_key(event));
	document.addEventListener("mouseup", (event) => gui.on_mouse_up(event))
	document.addEventListener("mousemove", (event) => gui.on_mouse_move(event))
	var conn = new WebSocket("ws://" + document.location.host + "/ws");
	conn.binaryType = "arraybuffer";
	setInterval(() => { gui.send_data(conn) }, 100)
	function recieve_data(event) {
		var indices = new Uint32Array(event.data)
		console.log(indices.length)
		var flag = false
		for (var i = 0; i < indices.length; i++) {
			var index = indices[i]
			if (index == 1000000000) {
				flag = true
				continue
			}
			if (flag) {
				gui.board.tiles[index].is_flagged = true
				gui.minimap.update_region(index)
			}
			else {
				gui.board.tiles[index].reveal()
				gui.minimap.update_region(index)
			}
		}
		window.requestAnimationFrame(() => gui.render_region());
	}
	conn.addEventListener('message', recieve_data);
	gui.render_region()	
}
gui.load_board_and_images().then(() => { start_listening() })




function reset() {
	gui.reset();
}

function apply() {
	gui.apply()
}