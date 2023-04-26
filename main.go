package main

import (
	"net/http"
	"log"
	"github.com/gorilla/websocket"
	"encoding/binary"
	"fmt"
	"bytes"
	"encoding/json"
	"math/rand"
	"time"
	"sync"
	"github.com/fsnotify/fsnotify"
	"io/ioutil"
)

type ServerConfig struct {
	Width int32
	Height int32
	Bombs int32
	Etag string
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

type Board_Event struct {
	Index int32
	Player int16
}

type Board struct {
	Width int32
	Height int32
	Bombs []int32
	revealed_history []Board_Event
	flag_history []Board_Event
	revealed_tiles []bool
}

// I have no idea why Go doesn't have a pop() function its stupid
type Stack struct {
	Values []int32
	Length int32
}

func load_config(config *ServerConfig)  {
	content, err := ioutil.ReadFile("config.json")
	if err != nil {
		log.Fatal(err)
	}
	err = json.Unmarshal(content, config)
	if err != nil {
		log.Println(err, content)
	}
	log.Println("Loaded config", config)
}

func handle_fs_events(watcher *fsnotify.Watcher, config *ServerConfig) {
	for {
		select {
		case event, ok := <-watcher.Events:
			if !ok {
				log.Println("fsnotify channel closed for some reason")
				return
			}
			if event.Op & fsnotify.Write == fsnotify.Write {
				load_config(config)
			}
		case err, ok := <-watcher.Errors:
			if !ok {
				log.Println("fsnotify error channel closed for some reason")
				return
			}
			log.Println("error:", err)
		}
	}
}

func watch_for_config_changes(config *ServerConfig) {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		log.Fatal(err)
	}
	watcher.Add("config.json")
	go handle_fs_events(watcher, config)
}

func make_stack(capacity int32) Stack {
	var stack = Stack{make([]int32, capacity), 0}
	return stack
}

func (stack *Stack) Pop() int32 {
	stack.Length -= 1
	return stack.Values[stack.Length]
}

func (stack *Stack) Push(val int32) {
	stack.Values[stack.Length] = val
	stack.Length += 1
}

func (stack *Stack) Print() {
	fmt.Printf("%v\n", stack.Values[0:stack.Length])
}

func make_board(width int32, height int32, num_bombs int32) Board {
	rand.Seed(time.Now().UTC().UnixNano())
	indicies := make([]int32, width * height)
	for i := int32(0); i < int32(len(indicies)); i++ {
     		 indicies[i] = i
	}
	rand.Shuffle(len(indicies), func(i, j int) {
		indicies[i], indicies[j] = indicies[j], indicies[i]
	})

	var bombs = indicies[0:num_bombs]

	//fmt.Printf("%d\n", bombs)
	//the boolean list already defaults to everything being false
	var board = Board{width, height, bombs, make([]Board_Event, 0, width * height * 2), make([]Board_Event, 0, width * height / 2), make([]bool, width * height)}
	return board
}

func get_board_json(board Board) []byte {
	b, err := json.Marshal(board)
	if err != nil {
		fmt.Println("error:", err)
	}
	return b
}

func check_complete(board Board) bool {
	var total_revealed = int32(0)
	for i := int32(0); i < board.Width * board.Height; i++ {
		if (board.revealed_tiles[i]) {
			total_revealed++
		}
	}
	return total_revealed >= board.Width * board.Height - int32(len(board.Bombs))
}


var config ServerConfig
var board Board
var board_json []byte
var game_id int32
var player_count = make(chan int16, 1)
var mutex = &sync.Mutex{}
var player_positions = make([]float32, 10000)
var num_players = int32(0)
var open_player_indices = make_stack(10000)
var player_state_mutex = &sync.Mutex{}
var fileserver = http.FileServer(http.Dir("./html"))


func read_reveals(conn *websocket.Conn, player_index int16, player_pos_index *int32, afk *bool, player_game_id *int32) {
	defer remove_player(player_pos_index)
	defer conn.Close()
	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			fmt.Printf("%v\n", err)
			return
		}
		buffer := bytes.NewReader(message);
		//fmt.Printf("Positions: %v\n", player_positions[0:num_players * 2])
		if (*player_pos_index >= num_players) {
			fmt.Printf("Switching index from %v\n", *player_pos_index)
			change_player_location(player_pos_index)
			fmt.Printf("New index %v\n", *player_pos_index)
		}
		var data int32
		var float_data float32

		// Since GoLang is kinda trash I'm going to copy paste this to read an integer >:(
		err = binary.Read(buffer, binary.BigEndian, &float_data)
		if err != nil {
			return
		}

		if (float_data < float32(0)) {
			*afk = true
			fmt.Printf("Player %v is afk\n", player_index)
			remove_player(player_pos_index)
			continue
		}
		if (*afk) {
			*afk = false
			fmt.Printf("Player %v is No Longer afk\n", player_index)
			*player_pos_index = add_player()
		}

		player_positions[2 * (*player_pos_index)] = float_data
		//fmt.Printf("Recieved coord: %v\n", float_data)

		err = binary.Read(buffer, binary.BigEndian, &float_data)
		if err != nil {
			return
		}

		player_positions[2 * (*player_pos_index) + 1] = float_data
		//fmt.Printf("Recieved coord: %v\n", float_data)

		var num_reveals int32
		var num_flags int32

		err = binary.Read(buffer, binary.BigEndian, &num_reveals)
		if err != nil {
			return
		}

		err = binary.Read(buffer, binary.BigEndian, &num_flags)
		if err != nil {
			return
		}

		if (num_reveals + num_flags > 0) {
			mutex.Lock()
			for i := int32(0); i < num_reveals; i++ {
				err = binary.Read(buffer, binary.BigEndian, &data)
				if err != nil {
					return
				}
				board.revealed_history = append(board.revealed_history, Board_Event{data, player_index})
				board.revealed_tiles[data] = true
			}
			
			for i := int32(0); i< num_flags; i++ {
				err = binary.Read(buffer, binary.BigEndian, &data)
				if err != nil {
					return
				}
				board.flag_history = append(board.flag_history, Board_Event{data, player_index})
			}
			mutex.Unlock()
		}

	}
}

func send_reveals(conn *websocket.Conn, player_index int16, player_pos_index *int32, afk *bool, player_game_id *int32) {
	ticker := time.NewTicker(33 * time.Millisecond)
	defer ticker.Stop()
	defer conn.Close()
	var reveal_index = 0
	var flag_index = 0
	for {
		<- ticker.C
		
		if (*afk) {
			continue
		}
		message, err := conn.NextWriter(websocket.BinaryMessage)
		if (*player_game_id != game_id) {
			reveal_index = 0;
			flag_index = 0;
			*player_game_id = game_id
			binary.Write(message, binary.BigEndian, int32(-1))
			if err := message.Close(); err != nil {
				return
			}
			continue
		}
		reveal_total := len(board.revealed_history)
		reveal_delta := reveal_total - reveal_index
		flag_total := len(board.flag_history)
		flag_delta := flag_total - flag_index
		
		if err != nil {
			return
		}
		binary.Write(message, binary.BigEndian, int32(num_players - 1))
		binary.Write(message, binary.BigEndian, int32(reveal_delta))
		binary.Write(message, binary.BigEndian, int32(flag_delta))
		for i := int32(0); i < num_players; i++ {
			if (i != *player_pos_index) {
				binary.Write(message, binary.BigEndian, player_positions[i * 2])
				binary.Write(message, binary.BigEndian, player_positions[i * 2 + 1])
			}
		}
		for i := reveal_index; i < reveal_total; i++ {
			binary.Write(message, binary.BigEndian, board.revealed_history[i].Index)
		}
		for i := flag_index; i < flag_total; i++ {
			binary.Write(message, binary.BigEndian, board.flag_history[i].Index)
		}
		if err := message.Close(); err != nil {
			return
		}
		reveal_index = reveal_total
		flag_index = flag_total
		
	}
}

func add_player() int32 {
	player_state_mutex.Lock()
	var player_pos_index = num_players
	if (open_player_indices.Length > 0 ) {
		var new_index = open_player_indices.Pop()
		if (new_index < num_players) {
			player_pos_index = new_index
		}
	} 
	num_players += 1
	player_state_mutex.Unlock()
	fmt.Printf("New player added at pos %v, total players is %v\n", player_pos_index, num_players)
	return player_pos_index
}

func remove_player(player_pos_index *int32) {
	if (*player_pos_index == int32(-1)) {
		return
	}
	player_state_mutex.Lock()
	player_positions[2 * (*player_pos_index)] = float32(-1)
	player_positions[2 * (*player_pos_index) + 1] = float32(-1)
	fmt.Printf("Changing number of players. Current value: %v\n", num_players)
	num_players = num_players - int32(1)
	fmt.Printf("New number of players: %v\n", num_players)
	if (*player_pos_index != num_players) {
		open_player_indices.Push(*player_pos_index)
	}
	*player_pos_index = int32(-1)
	player_state_mutex.Unlock()
}

func change_player_location(player_pos_index *int32) {
	player_state_mutex.Lock()
	if (open_player_indices.Length > 0 ) {
		var new_index = open_player_indices.Pop()
		if (new_index < num_players) {
			*player_pos_index = new_index
		}
	}
	player_state_mutex.Unlock()
}

func serveWs(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println(err)
		return
	}
	player_index := <-player_count
	fmt.Printf("New player index %d\n", player_index)
	player_count <- player_index + 1
	var player_pos_index = add_player()
	var afk = false
	var player_game_id = game_id
	go read_reveals(conn, player_index, &player_pos_index, &afk, &player_game_id);
	go send_reveals(conn, player_index, &player_pos_index, &afk, &player_game_id);
}



func serveBoard(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Write(board_json)
}
 
func ServeFilesWithEtags(w http.ResponseWriter, r *http.Request) {
	request_etag , ok := r.Header["If-None-Match"]
	if ok && request_etag[0] == config.Etag {
		w.WriteHeader(304)
		return
	}
	w.Header().Set("ETag", config.Etag)
	w.Header().Set("Cache-Control", "no-cache, must-revalidate")
	fileserver.ServeHTTP(w, r)
}

func init_board() {
	board = make_board(config.Width,config.Height,config.Bombs)
	board_json = get_board_json(board)
	game_id++
}

func auto_reset_on_completion() {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()
	for {
		<- ticker.C
		if (check_complete(board)) {
			init_board()
			log.Println("Starting new game: ", game_id)
		}
	}
}

func main() {
	load_config(&config)
	watch_for_config_changes(&config)
	player_count <- int16(0)
	init_board()
	go auto_reset_on_completion();
	http.HandleFunc("/", ServeFilesWithEtags)
	http.HandleFunc("/ws", serveWs)
	http.HandleFunc("/board", serveBoard)
	err := http.ListenAndServe(":80", nil)
	if err != nil {
		log.Fatal("ListenAndServe: ", err)
	}
}