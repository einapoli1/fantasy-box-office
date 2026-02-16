package main

import (
	"strconv"

	"github.com/gofiber/fiber/v2"
)

func createNotification(userID int, nType, title, body string, leagueID int) {
	db.Exec("INSERT INTO notifications (user_id, type, title, body, league_id) VALUES (?, ?, ?, ?, ?)",
		userID, nType, title, body, leagueID)
}

func getNotifications(c *fiber.Ctx) error {
	userID := getUserID(c)
	rows, err := db.Query(`SELECT id, type, title, body, league_id, read, created_at FROM notifications
		WHERE user_id = ? AND read = false ORDER BY created_at DESC LIMIT 50`, userID)
	if err != nil {
		return fiber.NewError(500, err.Error())
	}
	defer rows.Close()

	var notifs []fiber.Map
	for rows.Next() {
		var id, leagueID int
		var nType, title, body, createdAt string
		var read bool
		rows.Scan(&id, &nType, &title, &body, &leagueID, &read, &createdAt)
		notifs = append(notifs, fiber.Map{
			"id": id, "type": nType, "title": title, "body": body,
			"league_id": leagueID, "read": read, "created_at": createdAt,
		})
	}
	if notifs == nil {
		notifs = []fiber.Map{}
	}
	return c.JSON(notifs)
}

func markNotificationRead(c *fiber.Ctx) error {
	userID := getUserID(c)
	notifID, _ := strconv.Atoi(c.Params("id"))
	db.Exec("UPDATE notifications SET read = true WHERE id = ? AND user_id = ?", notifID, userID)
	return c.JSON(fiber.Map{"message": "Marked as read"})
}
