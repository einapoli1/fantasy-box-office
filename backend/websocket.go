package main

import (
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/websocket/v2"
)

// --- Draft WebSocket ---

type draftRoom struct {
	leagueID    int
	mu          sync.Mutex
	clients     map[*websocket.Conn]int // conn -> userID
	pickTimer   *time.Timer
	timerCancel chan struct{}
}

var (
	draftRooms   = make(map[int]*draftRoom)
	draftRoomsMu sync.Mutex
)

func getDraftRoom(leagueID int) *draftRoom {
	draftRoomsMu.Lock()
	defer draftRoomsMu.Unlock()
	if r, ok := draftRooms[leagueID]; ok {
		return r
	}
	r := &draftRoom{
		leagueID: leagueID,
		clients:  make(map[*websocket.Conn]int),
	}
	draftRooms[leagueID] = r
	return r
}

func (r *draftRoom) broadcast(msg interface{}) {
	data, _ := json.Marshal(msg)
	r.mu.Lock()
	defer r.mu.Unlock()
	for c := range r.clients {
		c.WriteMessage(websocket.TextMessage, data)
	}
}

func (r *draftRoom) startTimer() {
	r.mu.Lock()
	if r.pickTimer != nil {
		r.pickTimer.Stop()
	}
	r.timerCancel = make(chan struct{})
	cancel := r.timerCancel
	r.mu.Unlock()

	// Countdown broadcasts
	go func() {
		remaining := 90
		ticker := time.NewTicker(1 * time.Second)
		defer ticker.Stop()
		for remaining > 0 {
			select {
			case <-cancel:
				return
			case <-ticker.C:
				remaining--
				if remaining%10 == 0 || remaining <= 10 {
					r.broadcast(fiber.Map{"type": "timer", "seconds": remaining})
				}
			}
		}
		// Auto-pick
		r.autoPick()
	}()
}

func (r *draftRoom) stopTimer() {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.timerCancel != nil {
		close(r.timerCancel)
		r.timerCancel = nil
	}
}

func (r *draftRoom) autoPick() {
	var pickID, teamID int
	err := db.QueryRow("SELECT dp.id, dp.team_id FROM draft_picks dp WHERE dp.league_id = ? AND dp.movie_id IS NULL ORDER BY dp.pick_number LIMIT 1",
		r.leagueID).Scan(&pickID, &teamID)
	if err != nil {
		return
	}

	// Pick highest-budget available movie
	var movieID int
	err = db.QueryRow(`SELECT m.id FROM movies m WHERE m.id NOT IN 
		(SELECT movie_id FROM draft_picks WHERE league_id = ? AND movie_id IS NOT NULL)
		ORDER BY m.budget DESC LIMIT 1`, r.leagueID).Scan(&movieID)
	if err != nil {
		return
	}

	r.executePick(pickID, teamID, movieID, true)
}

func (r *draftRoom) executePick(pickID, teamID, movieID int, isAuto bool) {
	tx, _ := db.Begin()
	tx.Exec("UPDATE draft_picks SET movie_id = ? WHERE id = ?", movieID, pickID)
	tx.Exec("INSERT OR IGNORE INTO roster (team_id, movie_id, acquisition_type) VALUES (?, ?, 'draft')", teamID, movieID)
	tx.Exec("INSERT INTO transactions (league_id, team_id, movie_id, type) VALUES (?, ?, ?, 'draft')", r.leagueID, teamID, movieID)

	var remaining int
	tx.QueryRow("SELECT COUNT(*) FROM draft_picks WHERE league_id = ? AND movie_id IS NULL", r.leagueID).Scan(&remaining)
	if remaining == 0 {
		tx.Exec("UPDATE leagues SET status = 'active' WHERE id = ?", r.leagueID)
	}
	tx.Commit()

	// Get movie title
	var title string
	db.QueryRow("SELECT title FROM movies WHERE id = ?", movieID).Scan(&title)

	r.broadcast(fiber.Map{
		"type": "pick", "team_id": teamID, "movie_id": movieID,
		"movie_title": title, "auto": isAuto, "remaining": remaining,
	})

	// Create notification for the team owner
	var userID int
	db.QueryRow("SELECT user_id FROM teams WHERE id = ?", teamID).Scan(&userID)
	if isAuto {
		createNotification(userID, "draft_pick", "Auto-Pick", "Timer expired — "+title+" was auto-picked for your team", r.leagueID)
	}

	if remaining > 0 {
		r.sendState()
		r.startTimer()
	} else {
		r.broadcast(fiber.Map{"type": "draft_complete"})
	}
}

func (r *draftRoom) sendState() {
	var currentTeamID, currentPick, round int
	db.QueryRow(`SELECT team_id, pick_number, round FROM draft_picks WHERE league_id = ? AND movie_id IS NULL ORDER BY pick_number LIMIT 1`,
		r.leagueID).Scan(&currentTeamID, &currentPick, &round)

	r.broadcast(fiber.Map{
		"type": "state", "current_team": currentTeamID,
		"current_pick": currentPick, "round": round,
	})
}

func setupWebSocketRoutes(app *fiber.App) {
	app.Use("/ws", func(c *fiber.Ctx) error {
		if websocket.IsWebSocketUpgrade(c) {
			return c.Next()
		}
		return fiber.ErrUpgradeRequired
	})

	app.Get("/ws/draft/:leagueId", websocket.New(handleDraftWS))
	app.Get("/ws/chat/:leagueId", websocket.New(handleChatWS))
}

func handleDraftWS(c *websocket.Conn) {
	leagueID := 0
	if id := c.Params("leagueId"); id != "" {
		for _, ch := range id {
			leagueID = leagueID*10 + int(ch-'0')
		}
	}

	room := getDraftRoom(leagueID)
	room.mu.Lock()
	room.clients[c] = 0 // TODO: extract user from query params
	room.mu.Unlock()

	defer func() {
		room.mu.Lock()
		delete(room.clients, c)
		room.mu.Unlock()
		c.Close()
	}()

	// Send current state
	room.sendState()

	for {
		_, msg, err := c.ReadMessage()
		if err != nil {
			break
		}

		var payload struct {
			Type    string `json:"type"`
			MovieID int    `json:"movieId"`
			UserID  int    `json:"userId"`
		}
		if err := json.Unmarshal(msg, &payload); err != nil {
			continue
		}

		if payload.Type == "pick" && payload.MovieID > 0 {
			var pickID, teamID int
			err := db.QueryRow("SELECT dp.id, dp.team_id FROM draft_picks dp WHERE dp.league_id = ? AND dp.movie_id IS NULL ORDER BY dp.pick_number LIMIT 1",
				leagueID).Scan(&pickID, &teamID)
			if err != nil {
				continue
			}

			// Verify user owns team
			var pickUserID int
			db.QueryRow("SELECT user_id FROM teams WHERE id = ?", teamID).Scan(&pickUserID)
			if pickUserID != payload.UserID {
				c.WriteMessage(websocket.TextMessage, []byte(`{"type":"error","message":"Not your turn"}`))
				continue
			}

			// Check movie available
			var exists int
			db.QueryRow("SELECT COUNT(*) FROM draft_picks WHERE league_id = ? AND movie_id = ?", leagueID, payload.MovieID).Scan(&exists)
			if exists > 0 {
				c.WriteMessage(websocket.TextMessage, []byte(`{"type":"error","message":"Movie already drafted"}`))
				continue
			}

			room.stopTimer()
			room.executePick(pickID, teamID, payload.MovieID, false)
		}
	}
}

// --- Chat WebSocket ---

var (
	chatRooms   = make(map[int]map[*websocket.Conn]bool)
	chatRoomsMu sync.Mutex
)

func handleChatWS(c *websocket.Conn) {
	leagueID := 0
	if id := c.Params("leagueId"); id != "" {
		for _, ch := range id {
			leagueID = leagueID*10 + int(ch-'0')
		}
	}

	chatRoomsMu.Lock()
	if chatRooms[leagueID] == nil {
		chatRooms[leagueID] = make(map[*websocket.Conn]bool)
	}
	chatRooms[leagueID][c] = true
	chatRoomsMu.Unlock()

	defer func() {
		chatRoomsMu.Lock()
		delete(chatRooms[leagueID], c)
		chatRoomsMu.Unlock()
		c.Close()
	}()

	for {
		_, msg, err := c.ReadMessage()
		if err != nil {
			break
		}

		var payload struct {
			UserID  int    `json:"userId"`
			Message string `json:"message"`
		}
		if err := json.Unmarshal(msg, &payload); err != nil || payload.Message == "" {
			continue
		}

		// Save to DB
		res, err := db.Exec("INSERT INTO league_messages (league_id, user_id, message) VALUES (?, ?, ?)",
			leagueID, payload.UserID, payload.Message)
		if err != nil {
			continue
		}
		msgID, _ := res.LastInsertId()

		var displayName string
		db.QueryRow("SELECT display_name FROM users WHERE id = ?", payload.UserID).Scan(&displayName)

		broadcast := fiber.Map{
			"type": "chat", "id": msgID, "user_id": payload.UserID,
			"display_name": displayName, "message": payload.Message,
			"created_at": time.Now().Format(time.RFC3339),
		}
		data, _ := json.Marshal(broadcast)

		chatRoomsMu.Lock()
		for conn := range chatRooms[leagueID] {
			conn.WriteMessage(websocket.TextMessage, data)
		}
		chatRoomsMu.Unlock()
	}
}

func broadcastChat(leagueID int, msg fiber.Map) {
	data, _ := json.Marshal(msg)
	chatRoomsMu.Lock()
	defer chatRoomsMu.Unlock()
	for conn := range chatRooms[leagueID] {
		conn.WriteMessage(websocket.TextMessage, data)
	}
}

func init() {
	log.Println("WebSocket module loaded")
}
