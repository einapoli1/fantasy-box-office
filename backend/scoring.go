package main

import (
	"log"
	"math"

	"github.com/gofiber/fiber/v2"
)

type movieData struct {
	ID               int
	Budget           float64
	DomesticGross    float64
	WorldwideGross   float64
	RTScore          float64
	OpeningWeekend   float64
	Status           string
}

func calculateMoviePoints(m movieData) float64 {
	if m.Status == "upcoming" {
		return 0
	}

	points := 0.0

	// $1M opening weekend = 1 point
	points += m.OpeningWeekend / 1_000_000.0

	// $1M domestic gross = 0.5 points
	points += m.DomesticGross / 1_000_000.0 * 0.5

	// $1M worldwide gross = 0.25 points
	points += m.WorldwideGross / 1_000_000.0 * 0.25

	// RT certified fresh (75%+) = 10 bonus
	if m.RTScore >= 75 {
		points += 10
	}

	// #1 opening weekend = 15 bonus (tracked via opening_weekend_rank if available; for now use highest opening weekend heuristic)
	// We'll award this separately if needed; skip for now unless opening_weekend > 0 and is very high

	// $100M+ domestic = 20 bonus
	if m.DomesticGross >= 100_000_000 {
		points += 20
	}

	// $500M+ worldwide = 50 bonus
	if m.WorldwideGross >= 500_000_000 {
		points += 50
	}

	// Flop penalty: budget > 2x gross => -10
	if m.Budget > 0 && m.WorldwideGross > 0 && m.Budget > 2*m.WorldwideGross {
		points -= 10
	}

	return math.Round(points*100) / 100
}

func recalculateAllScores() error {
	rows, err := db.Query(`SELECT id, budget, domestic_gross, worldwide_gross, rt_score, opening_weekend_gross, status FROM movies`)
	if err != nil {
		return err
	}
	defer rows.Close()

	tx, err := db.Begin()
	if err != nil {
		return err
	}

	for rows.Next() {
		var m movieData
		if err := rows.Scan(&m.ID, &m.Budget, &m.DomesticGross, &m.WorldwideGross, &m.RTScore, &m.OpeningWeekend, &m.Status); err != nil {
			continue
		}
		pts := calculateMoviePoints(m)
		tx.Exec("UPDATE movies SET points = ? WHERE id = ?", pts, m.ID)
	}

	// Update team total_points
	tx.Exec(`UPDATE teams SET total_points = COALESCE(
		(SELECT SUM(m.points) FROM roster r JOIN movies m ON m.id = r.movie_id WHERE r.team_id = teams.id), 0)`)

	if err := tx.Commit(); err != nil {
		return err
	}

	log.Println("Recalculated all scores")
	return nil
}

func recalculateHandler(c *fiber.Ctx) error {
	if err := recalculateAllScores(); err != nil {
		return fiber.NewError(500, "Failed to recalculate: "+err.Error())
	}
	return c.JSON(fiber.Map{"message": "Scores recalculated"})
}
