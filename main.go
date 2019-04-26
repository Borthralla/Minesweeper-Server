package main

import (
	"net/http"
	"log"
	"github.com/gorilla/websocket"
	"encoding/binary"
	"fmt"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

var x uint32 = 0;
var y uint32 = 0;

func monitor_position(conn *websocket.Conn) {
	for {
		_, message, err := conn.ReadMessage()

		if err != nil {
			fmt.Println("%v", err)
			return
		}

		x = binary.LittleEndian.Uint32(message[0:4])
		y = binary.LittleEndian.Uint32(message[4:8])
		fmt.Println("%d, %d", x, y)
	}
}

func serveWs(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println(err)
		return
	}

	go monitor_position(conn);
}

func main() {
	http.Handle("/", http.FileServer(http.Dir("./html")))
	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		serveWs(w, r)
	})
	err := http.ListenAndServe(":8080", nil)
	if err != nil {
		log.Fatal("ListenAndServe: ", err)
	}
}