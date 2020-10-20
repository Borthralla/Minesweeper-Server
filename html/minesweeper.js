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
		if (revealed_tile.is_bomb) {
			this.status = "lose";
			this.bombs_left -= 1;
			this.flag_history.push(index)
			return;
		}
		else {
			this.tiles_left -= 1;
		}
		this.reveal_history.push(index)
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
	//hover warning tiles are the tiles that the user is about to click or chord. If click, its one thing, if chord a list
	render_region(ctx, tile_size, colors, row, col, width, height, x, y, hover_warning_tiles) {
		for (var r = 0; r <  height; r++) {
			for (var c = 0; c < width; c++) {
				var current_row = row + r;
				var current_col = col + c;
				var index = this.width * current_row + current_col;
				var tile = this.tiles[index];
				var tile_x = tile_size * c + x;
				var tile_y = tile_size * r + y;
				this.draw_tile(tile, ctx, tile_size, tile_x, tile_y, colors, hover_warning_tiles);
			}
		}
	}

	draw_number(tile, ctx, tile_size, x, y, colors) {
		ctx.drawImage(colors[tile.number], x, y);
	}

	draw_tile(tile, ctx, tile_size, x, y, colors, hover_warning_tiles) {
		if (hover_warning_tiles.includes(tile) && !tile.is_flagged) {
			ctx.drawImage(colors[0], x, y);
			return
		}
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

	count_bombs(bombs) {
		for (var index of bombs) {
			var region_index = this.get_region_index(index)
			this.region_counts[region_index] -= 1
			if (this.region_counts[region_index] == 0) {
				this.draw_region(region_index)
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
		else if (region_count <= 0) {
			return "#00ff00"
		}
		else {
			return "#ffff00"
		}
	}

	on_click(event) {
		var in_bounds = this.change_position(event)
		if (in_bounds) {
			this.dragging = true
		}
		return in_bounds
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
    	var x = event.clientX - rect.left - Math.floor(this.gui.window_width / (2 * this.region_width))
    	var y = event.clientY - rect.top - Math.floor(this.gui.window_height / (2 * this.region_height))
    	if (x < -1 || x >= this.width || y < -1 || y >= this.height) {
    		return false
    	}

    	this.gui.update_position(this.gui.tile_size * this.region_width * x, this.gui.tile_size * this.region_height * y)
    	return true
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

	draw_players() {
		var ctx = this.canvas.getContext("2d");
		ctx.fillStyle = "#ff1493"
		for (var i = 0; i < this.gui.player_positions.length / 2; i++) {
			var x = Math.floor(this.gui.player_positions[2 * i] / this.region_width)
			var y = Math.floor(this.gui.player_positions[2 * i + 1] / this.region_height)
			if (x >= 0) {
				ctx.fillRect(x, y, 2, 2)
			}
		}
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
		this.draw_players()
	}
}

class Gui {
	constructor() {
		this.canvas = document.getElementById("myCanvas");
		this.ctx = this.canvas.getContext("2d", { alpha: false });
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
		this.left_mouse_down = false;
		this.right_mouse_down = false;
		this.render_callback = this.render_region.bind(this)
		this.player_positions = []
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
		this.minimap.count_bombs(board_data["Bombs"])
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

	//Tile that the mouse is hovering over
	hovered_tile() {
		var rect = this.canvas.getBoundingClientRect();
    	var x = this.cursor_x - rect.left + this.current_x;
    	var y = this.cursor_y - rect.top + this.current_y;
		var row = Math.floor(y / this.tile_size);
		var col = Math.floor(x / this.tile_size);
		return row * this.board.width + col
	}

	//Supplies tile-normalized x and y coordinates. ex. 3.2 tiles right, 9.5 tiles down
	tile_normalized_coord() {
		var rect = this.canvas.getBoundingClientRect();
		var x = this.cursor_x - rect.left + this.current_x;
		var y = this.cursor_y - rect.top + this.current_y;
		var row = y / this.tile_size;
		var col = x / this.tile_size;
		return [col, row]
	}

	//Tiles that need to be warned
	hover_warning_tiles() {
		if (!this.left_mouse_down) {
			return []
		}
		var hovered_tile = this.hovered_tile()
		if (this.right_mouse_down) {
			return this.board.covered_radius(hovered_tile)
		}
		if (this.board.tiles[hovered_tile].is_covered) {
			return [this.board.tiles[hovered_tile]]
		}
		return []
		
	}

	draw_triangle(x, y) {
		this.ctx.beginPath()
		this.ctx.moveTo(x, y)
		this.ctx.lineTo(x, y + 15)
		this.ctx.lineTo(x + 10, y + 10)
		this.ctx.fill()
	}

	draw_player(x, y) {
		this.ctx.fillStyle = "#663399"
		this.draw_triangle(x,y)
	}

	player_in_bounds(x, y) {
		var right_bound = this.current_x + (this.window_width + 1) * this.tile_size
		var bottom_bound = this.current_y + (this.window_height + 1) * this.tile_size
		return x >= this.current_x && x <= right_bound && y >= this.current_y && y <= bottom_bound
	}

	render_players() {
		for (var i = 0; i < this.player_positions.length / 2; i++) {
			var x = Math.floor(this.player_positions[2 * i] * this.tile_size)
			var y = Math.floor(this.player_positions[2 * i + 1] * this.tile_size)
			if (this.player_in_bounds(x, y)) {
				this.draw_player(x - this.current_x, y - this.current_y)
			}
		}
	}


	render_region() {
		//render_region(ctx, tile_size, colors, row, col, width, height, x, y) {
		var row = Math.floor(this.current_y / this.tile_size);
		var col = Math.floor(this.current_x / this.tile_size);
		var x = this.tile_size * col - this.current_x;
		var y = this.tile_size * row - this.current_y;
		var width_to_draw = this.current_x >= this.tile_size * (this.board.width - this.window_width) ? this.window_width : this.window_width + 1;
		var height_to_draw = this.current_y >= this.tile_size * (this.board.height - this.window_height) ? this.window_height : this.window_height + 1;

		this.board.render_region(this.ctx, this.tile_size, this.colors, row, col, width_to_draw, height_to_draw, x, y, this.hover_warning_tiles())
		this.minimap.render()
		this.render_players(x, y)
	}

	on_click(event) {
		var rect = this.canvas.getBoundingClientRect();
    	var x = event.clientX - rect.left + this.current_x;
    	var y = event.clientY - rect.top + this.current_y;
		var row = Math.floor(y / this.tile_size);
		var col = Math.floor(x / this.tile_size);
		if (this.minimap.on_click(event)) {
			return;
		}
		if (row >= this.board.height || row < 0 || col >= this.board.width || col < 0) {
			return;
		}
		else {
			var button = event.which
			var index = row * this.board.width + col
			if (button == 1) {
				this.left_mouse_down = true
			}
			if (button == 1 || button == 2) {
				var clicked_tile = this.board.tiles[index];
				if (event.shiftKey || button == 2 || (!clicked_tile.is_covered && clicked_tile.number == 0)) {
					this.is_dragging = true;
					this.anchor_x = event.x;
					this.anchor_y = event.y;
					this.prev_x = this.current_x;
					this.prev_y = this.current_y;
					console.log("Dragging...")
					return;
				}
				if (this.board.tiles_left == 0) {
					var now = new Date();
					var time = (now - this.start) / 1000;
					setTimeout("alert('time: " + time.toString() + "');", 1);
				}
			}
			else if (button == 3) {
				this.right_mouse_down = true
				if (!this.left_mouse_down) {
					this.board.flag(index);
					console.log(this.board.bombs_left);
				}	
			}
		}
		window.requestAnimationFrame(this.render_callback);
	}

	in_bounds(x, y) {
		var rect = this.canvas.getBoundingClientRect();
		return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
	}

	on_mouse_up(event) {
		this.is_dragging = false;
		this.minimap.dragging = false
		var button = event.which
		if (button == 1) {
			this.left_mouse_down = false
			if (event.shiftKey || !this.in_bounds(event.x, event.y)) {
				window.requestAnimationFrame(this.render_callback);
				return
			}
			var clicked_tile = this.board.tiles[this.hovered_tile()]
			if (clicked_tile.is_covered && !this.right_mouse_down) {
				this.board.reveal(clicked_tile.index);
			}
			else if (this.right_mouse_down) {
				this.board.chord(clicked_tile.index);
			}
			window.requestAnimationFrame(this.render_callback);
		}
		if (button == 3) {
			this.right_mouse_down = false
			if (this.left_mouse_down) {
				var clicked_tile = this.board.tiles[this.hovered_tile()]
				if (!clicked_tile.is_covered) {
					this.board.chord(clicked_tile.index);
					window.requestAnimationFrame(this.render_callback);
				}
			}
		}
		
	}

	on_mouse_move(event) {
		this.cursor_x = event.x;
		this.cursor_y = event.y;
		if (!this.is_dragging) {
			this.minimap.on_mouse_move(event)
			if (this.left_mouse_down) {
				window.requestAnimationFrame(this.render_callback);
			}
			return;
		}
		var dx =  this.anchor_x - event.x;
		var dy = this.anchor_y - event.y;
		var new_x = this.prev_x + dx;
		var new_y = this.prev_y + dy;
		this.update_position(new_x, new_y)
	}

	update_position(new_x, new_y) {
		var x_max = this.tile_size * (this.board.width - this.window_width)
		var y_max = this.tile_size * (this.board.height - this.window_height)
		if (new_x <= 0) {
			this.current_x = 0
		}
		else if (new_x >= x_max) {
			this.current_x = x_max
		}
		else {
			this.current_x = new_x
		}
		if (new_y <= 0) {
			this.current_y = 0
		}
		else if (new_y >= y_max) {
			this.current_y = y_max
		}
		else {
			this.current_y = new_y
		}
		window.requestAnimationFrame(this.render_callback);
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
		this.load_images().then(() => {window.requestAnimationFrame(this.render_callback);})
		
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
		window.requestAnimationFrame(this.render_callback);
	}

	send_data(conn) {
		var reveal_delta = this.board.reveal_history.length - this.reveal_index
		var flag_delta = this.board.flag_history.length - this.flag_index
		var [x, y] = gui.tile_normalized_coord()
		if (!gui.in_bounds(gui.cursor_x, gui.cursor_y)) {
			return
		}
		var message_data = new ArrayBuffer((4 + reveal_delta + flag_delta) * 4)
		var message = new DataView(message_data)
		console.log("positions: ", x, y)
		message.setFloat32(0, x)
		message.setFloat32(4, y)
		message.setInt32(8, reveal_delta)
		message.setInt32(12, flag_delta)
		var section_start = 4
		for (var i = 0; i < reveal_delta; i++) {
			var revealed_index = this.board.reveal_history[this.reveal_index + i]
			message.setInt32((section_start + i) * 4, revealed_index)
			this.minimap.update_region(revealed_index)
		}
		section_start += reveal_delta
		for (var i = 0; i < flag_delta; i++) {
			message.setInt32((section_start + i) * 4, this.board.flag_history[this.flag_index + i])
		}
		conn.send(message)
		this.reveal_index = this.board.reveal_history.length;
		this.flag_index = this.board.flag_history.length;
		console.log("sending message:", message)
	}

}


var gui = new Gui();
function start_listening() {
	document.addEventListener("mousedown", (event) => gui.on_click(event));
	//document.addEventListener("keydown", (event) => gui.on_key(event));
	document.addEventListener("mouseup", (event) => gui.on_mouse_up(event))
	document.addEventListener("mousemove", (event) => gui.on_mouse_move(event))
	var conn = new WebSocket("ws://" + document.location.host + "/ws");
	conn.binaryType = "arraybuffer";
	setInterval(() => { gui.send_data(conn) }, 33)

	function on_visibility_change() {
		console.log("visibility has changed")
		if (document.hidden) {
			var buffer = new ArrayBuffer(4)
			var message = new DataView(buffer)
			message.setFloat32(0, -1)
			console.log("tab is hidden, sending AFK message")
			conn.send(message)
		}
	}

	function recieve_data(event) {
		var message = new DataView(event.data)
		num_players = message.getInt32(0)
		num_reveals = message.getInt32(4)
		num_flags = message.getInt32(8)
		gui.player_positions.length = num_players * 2
		var section_start = 3
		for (var i = 0; i < num_players; i++) {
			gui.player_positions[2 * i] = message.getFloat32(4 * (section_start + (2 * i)))
			gui.player_positions[2 * i + 1] = message.getFloat32(4 * (section_start + (2 * i + 1)))
		}
		section_start += num_players * 2
		for (var i = section_start; i < num_reveals + section_start; i++) {
			var index = message.getInt32(i * 4)
			var tile = gui.board.tiles[index]
			if (tile && tile.is_covered) {
				tile.reveal()
				gui.minimap.update_region(index)
			}
		}
		section_start += num_reveals
		for (var i = section_start; i < num_flags + section_start; i++) {
			var index = message.getInt32(i * 4)
			var tile = gui.board.tiles[index]
			if (tile && !tile.is_flagged) {
				tile.is_flagged = true
			}
		}
		window.requestAnimationFrame(gui.render_callback);
	}
	conn.addEventListener('message', recieve_data);
	document.addEventListener("visibilitychange", on_visibility_change)
	gui.render_region()	
}
gui.load_board_and_images().then(() => { start_listening() })




function reset() {
	gui.reset();
}

function apply() {
	gui.apply()
}