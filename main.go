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
)

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

}

func make_board(width int32, height int32, num_bombs int32) Board {
	indicies := make([]int32, width * height)
	for i := int32(0); i < int32(len(indicies)); i++ {
     		 indicies[i] = i
	}
	rand.Shuffle(len(indicies), func(i, j int) {
		indicies[i], indicies[j] = indicies[j], indicies[i]
	})

	var bombs = indicies[0:num_bombs]

	//fmt.Printf("%d\n", bombs)

	var board = Board{width, height, bombs, make([]Board_Event, 0, width * height * 2)}
	return board
}

func get_board_json(board Board) []byte {
	b, err := json.Marshal(board)
	if err != nil {
		fmt.Println("error:", err)
	}
	return b
}

var board = make_board(1000,1000,150000)
var board_json = get_board_json(board)
var player_count = make(chan int16, 1)
var mutex = &sync.Mutex{}



func read_reveals(conn *websocket.Conn, player_index int16) {
	for {
		_, message, err := conn.ReadMessage()

		if err != nil {
			fmt.Printf("%v\n", err)
			return
		}

		buffer := bytes.NewReader(message);
		mutex.Lock()
		for {
			var index int32
			err := binary.Read(buffer, binary.LittleEndian, &index)
			if err != nil {
				break
			} else {
				board.revealed_history = append(board.revealed_history, Board_Event{index, player_index})
			}
		}
		mutex.Unlock()
	}
}

func send_reveals(conn *websocket.Conn, player_index int16) {
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()
	var reveal_index = 0
	for {
		<- ticker.C
		reveal_total := len(board.revealed_history)
		reveal_delta := reveal_total - reveal_index
		if (reveal_delta > 0) {
			message, err := conn.NextWriter(websocket.BinaryMessage)
			if err != nil {
				return
			}
			for i := reveal_index; i < reveal_total; i++ {
				var reveal_entry = board.revealed_history[i]
				if (reveal_entry.Player != player_index) {
					binary.Write(message, binary.LittleEndian, reveal_entry.Index)
				}
			}
			if err := message.Close(); err != nil {
				return
			}
			reveal_index = reveal_total
		}
	}
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
	fmt.Printf("Done with player counts")

	go read_reveals(conn, player_index);
	go send_reveals(conn, player_index);
}



func serveBoard(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Write(board_json)
}

func main() {
	rand.Seed(time.Now().UTC().UnixNano())
	player_count <- int16(0)
	http.Handle("/", http.FileServer(http.Dir("./html")))
	http.HandleFunc("/ws", serveWs)
	http.HandleFunc("/board", serveBoard)
	err := http.ListenAndServe(":8080", nil)
	if err != nil {
		log.Fatal("ListenAndServe: ", err)
	}
}