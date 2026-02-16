package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"time"

	"github.com/gofiber/fiber/v2"
)

var tmdbAPIKey string

func initTMDB() {
	tmdbAPIKey = os.Getenv("TMDB_API_KEY")
	if tmdbAPIKey == "" {
		tmdbAPIKey = "93afb61a747d2b8daea0d622a042d981"
	}
}

const tmdbBase = "https://api.themoviedb.org/3"
const tmdbImageBase = "https://image.tmdb.org/t/p/w500"

type tmdbMovieList struct {
	Results []tmdbMovie `json:"results"`
}

type tmdbMovie struct {
	ID          int     `json:"id"`
	Title       string  `json:"title"`
	ReleaseDate string  `json:"release_date"`
	PosterPath  string  `json:"poster_path"`
	Overview    string  `json:"overview"`
	Budget      float64 `json:"budget"`
	Revenue     float64 `json:"revenue"`
	Runtime     int     `json:"runtime"`
	Genres      []struct {
		ID   int    `json:"id"`
		Name string `json:"name"`
	} `json:"genres"`
}

func tmdbGet(path string) ([]byte, error) {
	sep := "?"
	if len(path) > 0 && path[len(path)-1] != '?' && contains(path, "?") {
		sep = "&"
	}
	u := tmdbBase + path + sep + "api_key=" + tmdbAPIKey
	resp, err := http.Get(u)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	return io.ReadAll(resp.Body)
}

func contains(s, sub string) bool {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}

func tmdbFetchList(endpoint string) ([]tmdbMovie, error) {
	data, err := tmdbGet(endpoint)
	if err != nil {
		return nil, err
	}
	var list tmdbMovieList
	if err := json.Unmarshal(data, &list); err != nil {
		return nil, err
	}
	return list.Results, nil
}

func tmdbFetchDetails(tmdbID int) (*tmdbMovie, error) {
	data, err := tmdbGet(fmt.Sprintf("/movie/%d", tmdbID))
	if err != nil {
		return nil, err
	}
	var m tmdbMovie
	if err := json.Unmarshal(data, &m); err != nil {
		return nil, err
	}
	return &m, nil
}

func posterURL(path string) string {
	if path == "" {
		return ""
	}
	return tmdbImageBase + path
}

func tmdbSyncHandler(c *fiber.Ctx) error {
	upcoming, err1 := tmdbFetchList("/movie/upcoming")
	nowPlaying, err2 := tmdbFetchList("/movie/now_playing")
	if err1 != nil && err2 != nil {
		return fiber.NewError(500, "Failed to fetch from TMDB")
	}

	all := make(map[int]tmdbMovie)
	for _, m := range upcoming {
		all[m.ID] = m
	}
	for _, m := range nowPlaying {
		all[m.ID] = m
	}

	now := time.Now().Format("2006-01-02")
	synced := 0

	for _, m := range all {
		// Fetch details for budget/revenue
		details, err := tmdbFetchDetails(m.ID)
		if err != nil {
			details = &m
		}

		status := "upcoming"
		if m.ReleaseDate != "" && m.ReleaseDate <= now {
			status = "released"
		}

		poster := posterURL(m.PosterPath)
		budget := details.Budget
		revenue := details.Revenue

		// Upsert: try update first, then insert
		res, _ := db.Exec(`UPDATE movies SET title=?, release_date=?, poster_url=?, budget=?, domestic_gross=?, worldwide_gross=?, status=?
			WHERE tmdb_id=?`,
			m.Title, m.ReleaseDate, poster, budget, revenue, revenue, status, m.ID)
		rows, _ := res.RowsAffected()
		if rows == 0 {
			db.Exec(`INSERT INTO movies (tmdb_id, title, release_date, poster_url, budget, domestic_gross, worldwide_gross, status)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
				m.ID, m.Title, m.ReleaseDate, poster, budget, revenue, revenue, status)
		}
		synced++
	}

	return c.JSON(fiber.Map{"synced": synced, "message": fmt.Sprintf("Synced %d movies from TMDB", synced)})
}

func tmdbSearchHandler(c *fiber.Ctx) error {
	q := c.Query("q")
	if q == "" {
		return fiber.NewError(400, "Query parameter 'q' required")
	}

	data, err := tmdbGet("/search/movie?query=" + url.QueryEscape(q))
	if err != nil {
		return fiber.NewError(500, "TMDB search failed")
	}
	var list tmdbMovieList
	if err := json.Unmarshal(data, &list); err != nil {
		return fiber.NewError(500, "Failed to parse TMDB response")
	}

	var results []fiber.Map
	for _, m := range list.Results {
		results = append(results, fiber.Map{
			"tmdb_id":      m.ID,
			"title":        m.Title,
			"release_date": m.ReleaseDate,
			"poster_url":   posterURL(m.PosterPath),
			"overview":     m.Overview,
		})
	}
	if results == nil {
		results = []fiber.Map{}
	}
	return c.JSON(results)
}

// fixSeedPosters updates any poster URLs that use the old tmdb_id.jpg pattern
func fixSeedPosters() {
	rows, err := db.Query("SELECT id, tmdb_id, poster_url FROM movies WHERE poster_url GLOB '*[0-9].jpg'")
	if err != nil {
		return
	}
	defer rows.Close()

	type movie struct {
		id, tmdbID int
		posterURL  string
	}
	var toFix []movie
	for rows.Next() {
		var m movie
		rows.Scan(&m.id, &m.tmdbID, &m.posterURL)
		toFix = append(toFix, m)
	}

	for _, m := range toFix {
		details, err := tmdbFetchDetails(m.tmdbID)
		if err != nil || details.PosterPath == "" {
			continue
		}
		db.Exec("UPDATE movies SET poster_url = ? WHERE id = ?", posterURL(details.PosterPath), m.id)
	}
	if len(toFix) > 0 {
		fmt.Printf("Fixed poster URLs for %d movies\n", len(toFix))
	}
}
