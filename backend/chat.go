package main

import (
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
)

func getChatMessages(c *fiber.Ctx) error {
	leagueID, _ := strconv.Atoi(c.Params("id"))
	limit, _ := strconv.Atoi(c.Query("limit", "50"))
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	before := c.Query("before")

	query := `SELECT lm.id, lm.league_id, lm.user_id, lm.message, lm.created_at, u.display_name
		FROM league_messages lm JOIN users u ON u.id = lm.user_id
		WHERE lm.league_id = ?`
	args := []interface{}{leagueID}

	if before != "" {
		query += " AND lm.id < ?"
		beforeID, _ := strconv.Atoi(before)
		args = append(args, beforeID)
	}

	query += " ORDER BY lm.id DESC LIMIT ?"
	args = append(args, limit)

	rows, err := db.Query(query, args...)
	if err != nil {
		return fiber.NewError(500, err.Error())
	}
	defer rows.Close()

	var messages []fiber.Map
	for rows.Next() {
		var id, lid, uid int
		var msg, createdAt, displayName string
		rows.Scan(&id, &lid, &uid, &msg, &createdAt, &displayName)
		messages = append(messages, fiber.Map{
			"id": id, "league_id": lid, "user_id": uid,
			"message": msg, "created_at": createdAt, "display_name": displayName,
		})
	}
	if messages == nil {
		messages = []fiber.Map{}
	}
	return c.JSON(messages)
}

func sendChatMessage(c *fiber.Ctx) error {
	userID := getUserID(c)
	leagueID, _ := strconv.Atoi(c.Params("id"))

	var body struct {
		Message string `json:"message"`
	}
	if err := c.BodyParser(&body); err != nil || body.Message == "" {
		return fiber.NewError(400, "Message required")
	}

	res, err := db.Exec("INSERT INTO league_messages (league_id, user_id, message) VALUES (?, ?, ?)",
		leagueID, userID, body.Message)
	if err != nil {
		return fiber.NewError(500, err.Error())
	}
	msgID, _ := res.LastInsertId()

	var displayName string
	db.QueryRow("SELECT display_name FROM users WHERE id = ?", userID).Scan(&displayName)

	msg := fiber.Map{
		"type": "chat", "id": msgID, "league_id": leagueID, "user_id": userID,
		"message": body.Message, "display_name": displayName,
		"created_at": time.Now().Format(time.RFC3339),
	}

	// Broadcast to WebSocket clients
	broadcastChat(leagueID, msg)

	return c.Status(201).JSON(msg)
}
