package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	_ "github.com/mattn/go-sqlite3"
	"golang.org/x/crypto/bcrypt"
)

var db *sql.DB
var jwtSecret = []byte("fantasy-box-office-secret-change-me")

func main() {
	var err error
	db, err = sql.Open("sqlite3", "./fantasy.db?_journal_mode=WAL&_foreign_keys=on")
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	schema, err := os.ReadFile("schema.sql")
	if err != nil {
		log.Fatal("Failed to read schema.sql:", err)
	}
	if _, err := db.Exec(string(schema)); err != nil {
		log.Fatal("Failed to execute schema:", err)
	}

	initTMDB()
	runMigrations()
	seedMovies()
	go fixSeedPosters()
	go scheduledSync()

	app := fiber.New(fiber.Config{ErrorHandler: func(c *fiber.Ctx, err error) error {
		code := fiber.StatusInternalServerError
		if e, ok := err.(*fiber.Error); ok {
			code = e.Code
		}
		return c.Status(code).JSON(fiber.Map{"error": err.Error()})
	}})

	app.Use(logger.New())
	app.Use(cors.New(cors.Config{AllowOrigins: "*", AllowHeaders: "Origin, Content-Type, Accept, Authorization"}))

	api := app.Group("/api")

	// Auth
	api.Post("/auth/register", register)
	api.Post("/auth/login", login)

	// Protected routes
	api.Use("/leagues", authMiddleware)
	api.Use("/teams", authMiddleware)
	api.Use("/trades", authMiddleware)
	api.Use("/waivers", authMiddleware)

	// Leagues
	api.Get("/leagues", getLeagues)
	api.Post("/leagues", createLeague)
	api.Get("/leagues/:id", getLeague)
	api.Post("/leagues/:id/join", joinLeague)
	api.Get("/leagues/:id/standings", getStandings)
	api.Get("/leagues/:id/transactions", getTransactions)
	api.Post("/leagues/:id/draft/start", startDraft)
	api.Post("/leagues/:id/draft/pick", makeDraftPick)
	api.Get("/leagues/:id/draft/status", getDraftStatus)
	api.Get("/leagues/:id/waivers", getLeagueWaivers)

	// Teams
	api.Get("/teams/:id", getTeam)
	api.Get("/teams/:id/roster", getTeamRoster)

	// Movies (public)
	app.Get("/api/movies", getMovies)
	app.Get("/api/movies/:id", getMovie)

	// TMDB (public)
	app.Post("/api/tmdb/sync", tmdbSyncHandler)
	app.Get("/api/tmdb/sync", tmdbSyncHandler)
	app.Get("/api/tmdb/search", tmdbSearchHandler)

	// Trades
	api.Post("/trades", createTrade)
	api.Put("/trades/:id/accept", acceptTrade)
	api.Put("/trades/:id/reject", rejectTrade)

	// Waivers
	api.Post("/waivers/claim", claimWaiver)

	// Scoring
	app.Post("/api/scoring/recalculate", recalculateHandler)

	// League invite
	api.Get("/leagues/:id/invite", getLeagueInvite)
	app.Post("/api/leagues/join/:code", authMiddlewareOptional, joinLeagueByInvite)

	// Chat
	api.Get("/leagues/:id/chat", getChatMessages)
	api.Post("/leagues/:id/chat", sendChatMessage)

	// Notifications
	api.Use("/notifications", authMiddleware)
	api.Get("/notifications", getNotifications)
	api.Put("/notifications/:id/read", markNotificationRead)

	// Projections
	app.Get("/api/movies/:id/projection", getMovieProjection)

	// Trade analyzer
	api.Post("/trades/analyze", analyzeTrade)

	// Season history
	app.Get("/api/seasons/history", func(c *fiber.Ctx) error {
		// For now return current season standings as "history"
		// In future, completed seasons would be stored separately
		type Winner struct {
			Year     int     `json:"year"`
			Team     string  `json:"team_name"`
			Owner    string  `json:"owner"`
			Points   float64 `json:"points"`
			LeagueID int     `json:"league_id"`
		}
		type Record struct {
			Title string  `json:"title"`
			Value string  `json:"value"`
			Year  int     `json:"year"`
			Team  string  `json:"team"`
		}
		// Get top scoring team from completed leagues
		var winners []Winner
		rows, err := db.Query(`SELECT l.season_year, t.name, u.display_name, t.total_points, l.id 
			FROM teams t JOIN leagues l ON t.league_id = l.id JOIN users u ON t.user_id = u.id
			WHERE l.status = 'completed' ORDER BY l.season_year DESC, t.total_points DESC`)
		if err == nil {
			defer rows.Close()
			seen := map[int]bool{}
			for rows.Next() {
				var w Winner
				rows.Scan(&w.Year, &w.Team, &w.Owner, &w.Points, &w.LeagueID)
				if !seen[w.Year] {
					winners = append(winners, w)
					seen[w.Year] = true
				}
			}
		}
		// Get some records from current data
		var records []Record
		var topMovie struct{ title string; points float64 }
		db.QueryRow("SELECT title, points FROM movies ORDER BY points DESC LIMIT 1").Scan(&topMovie.title, &topMovie.points)
		if topMovie.title != "" {
			records = append(records, Record{Title: "Highest Scoring Movie", Value: fmt.Sprintf("%s (%.1f pts)", topMovie.title, topMovie.points), Year: 2025})
		}
		var topBudget struct{ title string; budget float64 }
		db.QueryRow("SELECT title, budget FROM movies ORDER BY budget DESC LIMIT 1").Scan(&topBudget.title, &topBudget.budget)
		if topBudget.title != "" {
			records = append(records, Record{Title: "Biggest Budget", Value: fmt.Sprintf("%s ($%.0fM)", topBudget.title, topBudget.budget/1e6), Year: 2025})
		}
		if winners == nil { winners = []Winner{} }
		if records == nil { records = []Record{} }
		return c.JSON(fiber.Map{"winners": winners, "records": records})
	})

	// WebSocket routes
	setupWebSocketRoutes(app)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8090"
	}
	log.Printf("Fantasy Box Office API running on :%s", port)
	log.Fatal(app.Listen(":" + port))
}

// --- Auth ---

func register(c *fiber.Ctx) error {
	var body struct {
		Email       string `json:"email"`
		Password    string `json:"password"`
		DisplayName string `json:"display_name"`
	}
	if err := c.BodyParser(&body); err != nil {
		return fiber.NewError(400, "Invalid request body")
	}
	if body.Email == "" || body.Password == "" {
		return fiber.NewError(400, "Email and password required")
	}
	if body.DisplayName == "" {
		body.DisplayName = strings.Split(body.Email, "@")[0]
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
	if err != nil {
		return fiber.NewError(500, "Failed to hash password")
	}

	res, err := db.Exec("INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)",
		body.Email, string(hash), body.DisplayName)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE") {
			return fiber.NewError(409, "Email already registered")
		}
		return fiber.NewError(500, "Failed to create user")
	}

	id, _ := res.LastInsertId()
	token := generateToken(int(id))
	return c.JSON(fiber.Map{
		"token": token,
		"user": fiber.Map{
			"id": id, "email": body.Email, "display_name": body.DisplayName, "avatar_url": "", "created_at": time.Now().Format(time.RFC3339),
		},
	})
}

func login(c *fiber.Ctx) error {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := c.BodyParser(&body); err != nil {
		return fiber.NewError(400, "Invalid request body")
	}

	var user struct {
		ID           int
		Email        string
		PasswordHash string
		DisplayName  string
		AvatarURL    string
		CreatedAt    string
	}
	err := db.QueryRow("SELECT id, email, password_hash, display_name, avatar_url, created_at FROM users WHERE email = ?", body.Email).
		Scan(&user.ID, &user.Email, &user.PasswordHash, &user.DisplayName, &user.AvatarURL, &user.CreatedAt)
	if err != nil {
		return fiber.NewError(401, "Invalid credentials")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(body.Password)); err != nil {
		return fiber.NewError(401, "Invalid credentials")
	}

	token := generateToken(user.ID)
	return c.JSON(fiber.Map{
		"token": token,
		"user": fiber.Map{
			"id": user.ID, "email": user.Email, "display_name": user.DisplayName,
			"avatar_url": user.AvatarURL, "created_at": user.CreatedAt,
		},
	})
}

func generateToken(userID int) string {
	claims := jwt.MapClaims{"user_id": float64(userID), "exp": float64(time.Now().Add(72 * time.Hour).Unix())}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	s, _ := token.SignedString(jwtSecret)
	return s
}

func authMiddleware(c *fiber.Ctx) error {
	auth := c.Get("Authorization")
	if !strings.HasPrefix(auth, "Bearer ") {
		return fiber.NewError(401, "Missing authorization token")
	}
	tokenStr := strings.TrimPrefix(auth, "Bearer ")
	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
		return jwtSecret, nil
	})
	if err != nil || !token.Valid {
		return fiber.NewError(401, "Invalid token")
	}
	claims := token.Claims.(jwt.MapClaims)
	c.Locals("user_id", int(claims["user_id"].(float64)))
	return c.Next()
}

func getUserID(c *fiber.Ctx) int {
	return c.Locals("user_id").(int)
}

// --- Leagues ---

func getLeagues(c *fiber.Ctx) error {
	userID := getUserID(c)
	rows, err := db.Query(`SELECT l.id, l.name, l.owner_id, l.season_year, l.draft_date, l.max_teams, l.status
		FROM leagues l JOIN teams t ON t.league_id = l.id WHERE t.user_id = ?`, userID)
	if err != nil {
		return fiber.NewError(500, err.Error())
	}
	defer rows.Close()

	var leagues []fiber.Map
	for rows.Next() {
		var l struct {
			ID, OwnerID, SeasonYear, MaxTeams int
			Name, Status                      string
			DraftDate                         sql.NullString
		}
		rows.Scan(&l.ID, &l.Name, &l.OwnerID, &l.SeasonYear, &l.DraftDate, &l.MaxTeams, &l.Status)
		dd := ""
		if l.DraftDate.Valid {
			dd = l.DraftDate.String
		}
		leagues = append(leagues, fiber.Map{
			"id": l.ID, "name": l.Name, "owner_id": l.OwnerID, "season_year": l.SeasonYear,
			"draft_date": dd, "max_teams": l.MaxTeams, "status": l.Status,
		})
	}
	if leagues == nil {
		leagues = []fiber.Map{}
	}
	return c.JSON(leagues)
}

func createLeague(c *fiber.Ctx) error {
	userID := getUserID(c)
	var body struct {
		Name       string `json:"name"`
		SeasonYear int    `json:"season_year"`
		DraftDate  string `json:"draft_date"`
		MaxTeams   int    `json:"max_teams"`
		TeamName   string `json:"team_name"`
	}
	if err := c.BodyParser(&body); err != nil {
		return fiber.NewError(400, "Invalid request")
	}
	if body.Name == "" {
		return fiber.NewError(400, "League name required")
	}
	if body.SeasonYear == 0 {
		body.SeasonYear = time.Now().Year()
	}
	if body.MaxTeams == 0 {
		body.MaxTeams = 8
	}
	if body.TeamName == "" {
		body.TeamName = "My Team"
	}

	inviteCode := uuid.New().String()
	tx, _ := db.Begin()
	res, err := tx.Exec("INSERT INTO leagues (name, owner_id, season_year, draft_date, max_teams, invite_code) VALUES (?, ?, ?, ?, ?, ?)",
		body.Name, userID, body.SeasonYear, body.DraftDate, body.MaxTeams, inviteCode)
	if err != nil {
		tx.Rollback()
		return fiber.NewError(500, err.Error())
	}
	leagueID, _ := res.LastInsertId()

	_, err = tx.Exec("INSERT INTO teams (league_id, user_id, name) VALUES (?, ?, ?)", leagueID, userID, body.TeamName)
	if err != nil {
		tx.Rollback()
		return fiber.NewError(500, err.Error())
	}
	tx.Commit()

	return c.Status(201).JSON(fiber.Map{"id": leagueID, "name": body.Name, "status": "pending", "invite_code": inviteCode})
}

func getLeague(c *fiber.Ctx) error {
	id, _ := strconv.Atoi(c.Params("id"))
	var l struct {
		ID, OwnerID, SeasonYear, MaxTeams int
		Name, Status                      string
		DraftDate                         sql.NullString
	}
	err := db.QueryRow("SELECT id, name, owner_id, season_year, draft_date, max_teams, status FROM leagues WHERE id = ?", id).
		Scan(&l.ID, &l.Name, &l.OwnerID, &l.SeasonYear, &l.DraftDate, &l.MaxTeams, &l.Status)
	if err != nil {
		return fiber.NewError(404, "League not found")
	}

	// Get teams
	rows, _ := db.Query("SELECT t.id, t.name, t.total_points, u.display_name FROM teams t JOIN users u ON u.id = t.user_id WHERE t.league_id = ?", id)
	defer rows.Close()
	var teams []fiber.Map
	for rows.Next() {
		var tid int
		var tname string
		var pts float64
		var uname string
		rows.Scan(&tid, &tname, &pts, &uname)
		teams = append(teams, fiber.Map{"id": tid, "name": tname, "total_points": pts, "owner": uname})
	}

	dd := ""
	if l.DraftDate.Valid {
		dd = l.DraftDate.String
	}
	return c.JSON(fiber.Map{
		"id": l.ID, "name": l.Name, "owner_id": l.OwnerID, "season_year": l.SeasonYear,
		"draft_date": dd, "max_teams": l.MaxTeams, "status": l.Status, "teams": teams,
	})
}

func joinLeague(c *fiber.Ctx) error {
	userID := getUserID(c)
	leagueID, _ := strconv.Atoi(c.Params("id"))
	var body struct {
		TeamName string `json:"team_name"`
	}
	c.BodyParser(&body)
	if body.TeamName == "" {
		body.TeamName = "My Team"
	}

	// Check league exists and has space
	var maxTeams int
	var status string
	var count int
	db.QueryRow("SELECT max_teams, status FROM leagues WHERE id = ?", leagueID).Scan(&maxTeams, &status)
	if status != "pending" {
		return fiber.NewError(400, "League is not accepting new teams")
	}
	db.QueryRow("SELECT COUNT(*) FROM teams WHERE league_id = ?", leagueID).Scan(&count)
	if count >= maxTeams {
		return fiber.NewError(400, "League is full")
	}

	_, err := db.Exec("INSERT INTO teams (league_id, user_id, name) VALUES (?, ?, ?)", leagueID, userID, body.TeamName)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE") {
			return fiber.NewError(409, "Already in this league")
		}
		return fiber.NewError(500, err.Error())
	}
	return c.JSON(fiber.Map{"message": "Joined league"})
}

// --- Draft ---

func startDraft(c *fiber.Ctx) error {
	userID := getUserID(c)
	leagueID, _ := strconv.Atoi(c.Params("id"))

	var ownerID int
	var status string
	db.QueryRow("SELECT owner_id, status FROM leagues WHERE id = ?", leagueID).Scan(&ownerID, &status)
	if ownerID != userID {
		return fiber.NewError(403, "Only the league owner can start the draft")
	}
	if status != "pending" {
		return fiber.NewError(400, "Draft already started or league completed")
	}

	// Get teams, create draft order
	rows, _ := db.Query("SELECT id FROM teams WHERE league_id = ? ORDER BY RANDOM()", leagueID)
	defer rows.Close()
	var teamIDs []int
	for rows.Next() {
		var tid int
		rows.Scan(&tid)
		teamIDs = append(teamIDs, tid)
	}
	if len(teamIDs) < 2 {
		return fiber.NewError(400, "Need at least 2 teams to draft")
	}

	// Create snake draft picks (15 rounds)
	tx, _ := db.Begin()
	rounds := 15
	pickNum := 1
	for round := 1; round <= rounds; round++ {
		order := teamIDs
		if round%2 == 0 {
			// Reverse for snake
			order = make([]int, len(teamIDs))
			for i, tid := range teamIDs {
				order[len(teamIDs)-1-i] = tid
			}
		}
		for _, tid := range order {
			tx.Exec("INSERT INTO draft_picks (league_id, round, pick_number, team_id) VALUES (?, ?, ?, ?)",
				leagueID, round, pickNum, tid)
			pickNum++
		}
	}
	tx.Exec("UPDATE leagues SET status = 'drafting' WHERE id = ?", leagueID)
	tx.Commit()

	return c.JSON(fiber.Map{"message": "Draft started", "total_picks": pickNum - 1})
}

func makeDraftPick(c *fiber.Ctx) error {
	userID := getUserID(c)
	leagueID, _ := strconv.Atoi(c.Params("id"))
	var body struct {
		MovieID int `json:"movie_id"`
	}
	if err := c.BodyParser(&body); err != nil {
		return fiber.NewError(400, "Invalid request")
	}

	// Find next pick
	var pickID, teamID int
	err := db.QueryRow("SELECT dp.id, dp.team_id FROM draft_picks dp WHERE dp.league_id = ? AND dp.movie_id IS NULL ORDER BY dp.pick_number LIMIT 1",
		leagueID).Scan(&pickID, &teamID)
	if err != nil {
		return fiber.NewError(400, "No more picks available")
	}

	// Verify it's this user's turn
	var pickUserID int
	db.QueryRow("SELECT user_id FROM teams WHERE id = ?", teamID).Scan(&pickUserID)
	if pickUserID != userID {
		return fiber.NewError(403, "Not your turn to pick")
	}

	// Check movie isn't already drafted in this league
	var exists int
	db.QueryRow("SELECT COUNT(*) FROM draft_picks WHERE league_id = ? AND movie_id = ?", leagueID, body.MovieID).Scan(&exists)
	if exists > 0 {
		return fiber.NewError(400, "Movie already drafted")
	}

	tx, _ := db.Begin()
	tx.Exec("UPDATE draft_picks SET movie_id = ? WHERE id = ?", body.MovieID, pickID)
	tx.Exec("INSERT OR IGNORE INTO roster (team_id, movie_id, acquisition_type) VALUES (?, ?, 'draft')", teamID, body.MovieID)
	tx.Exec("INSERT INTO transactions (league_id, team_id, movie_id, type) VALUES (?, ?, ?, 'draft')", leagueID, teamID, body.MovieID)

	// Check if draft is complete
	var remaining int
	tx.QueryRow("SELECT COUNT(*) FROM draft_picks WHERE league_id = ? AND movie_id IS NULL", leagueID).Scan(&remaining)
	if remaining == 0 {
		tx.Exec("UPDATE leagues SET status = 'active' WHERE id = ?", leagueID)
	}
	tx.Commit()

	return c.JSON(fiber.Map{"message": "Pick made", "remaining": remaining})
}

func getDraftStatus(c *fiber.Ctx) error {
	leagueID, _ := strconv.Atoi(c.Params("id"))

	rows, err := db.Query(`SELECT dp.id, dp.round, dp.pick_number, dp.team_id, dp.movie_id,
		t.name as team_name, COALESCE(m.title,'') as movie_title, COALESCE(m.poster_url,'') as poster_url
		FROM draft_picks dp
		JOIN teams t ON t.id = dp.team_id
		LEFT JOIN movies m ON m.id = dp.movie_id
		WHERE dp.league_id = ? ORDER BY dp.pick_number`, leagueID)
	if err != nil {
		return fiber.NewError(500, err.Error())
	}
	defer rows.Close()

	var picks []fiber.Map
	for rows.Next() {
		var id, round, pickNum, teamID int
		var movieID sql.NullInt64
		var teamName, movieTitle, posterURL string
		rows.Scan(&id, &round, &pickNum, &teamID, &movieID, &teamName, &movieTitle, &posterURL)
		pick := fiber.Map{
			"id": id, "round": round, "pick_number": pickNum,
			"team_id": teamID, "team_name": teamName,
		}
		if movieID.Valid {
			pick["movie_id"] = movieID.Int64
			pick["movie_title"] = movieTitle
			pick["poster_url"] = posterURL
		}
		picks = append(picks, pick)
	}

	// Current pick
	var currentTeamID int
	var currentPick int
	db.QueryRow("SELECT team_id, pick_number FROM draft_picks WHERE league_id = ? AND movie_id IS NULL ORDER BY pick_number LIMIT 1",
		leagueID).Scan(&currentTeamID, &currentPick)

	return c.JSON(fiber.Map{
		"picks":           picks,
		"current_team_id": currentTeamID,
		"current_pick":    currentPick,
	})
}

// --- Teams ---

func getTeam(c *fiber.Ctx) error {
	id, _ := strconv.Atoi(c.Params("id"))
	var t struct {
		ID, LeagueID, UserID int
		Name                 string
		TotalPoints          float64
	}
	err := db.QueryRow("SELECT id, league_id, user_id, name, total_points FROM teams WHERE id = ?", id).
		Scan(&t.ID, &t.LeagueID, &t.UserID, &t.Name, &t.TotalPoints)
	if err != nil {
		return fiber.NewError(404, "Team not found")
	}
	return c.JSON(fiber.Map{"id": t.ID, "league_id": t.LeagueID, "user_id": t.UserID, "name": t.Name, "total_points": t.TotalPoints})
}

func getTeamRoster(c *fiber.Ctx) error {
	teamID, _ := strconv.Atoi(c.Params("id"))
	rows, _ := db.Query(`SELECT r.id, r.movie_id, r.acquired_at, r.acquisition_type,
		m.title, m.release_date, m.poster_url, m.budget, m.domestic_gross, m.worldwide_gross, m.rt_score, m.status
		FROM roster r JOIN movies m ON m.id = r.movie_id WHERE r.team_id = ?`, teamID)
	defer rows.Close()

	var roster []fiber.Map
	for rows.Next() {
		var rid, mid int
		var acqAt, acqType, title, relDate, poster, mstatus string
		var budget, domGross, wwGross, rt float64
		rows.Scan(&rid, &mid, &acqAt, &acqType, &title, &relDate, &poster, &budget, &domGross, &wwGross, &rt, &mstatus)
		roster = append(roster, fiber.Map{
			"id": rid, "movie_id": mid, "acquired_at": acqAt, "acquisition_type": acqType,
			"movie": fiber.Map{
				"id": mid, "title": title, "release_date": relDate, "poster_url": poster,
				"budget": budget, "domestic_gross": domGross, "worldwide_gross": wwGross,
				"rt_score": rt, "status": mstatus,
			},
		})
	}
	if roster == nil {
		roster = []fiber.Map{}
	}
	return c.JSON(roster)
}

// --- Movies ---

func getMovies(c *fiber.Ctx) error {
	status := c.Query("status")
	search := c.Query("search")
	query := "SELECT id, tmdb_id, title, release_date, poster_url, budget, domestic_gross, worldwide_gross, rt_score, status, points, projected_points FROM movies WHERE 1=1"
	var args []interface{}
	if status != "" {
		query += " AND status = ?"
		args = append(args, status)
	}
	if search != "" {
		query += " AND title LIKE ?"
		args = append(args, "%"+search+"%")
	}
	query += " ORDER BY release_date ASC LIMIT 200"

	rows, err := db.Query(query, args...)
	if err != nil {
		return fiber.NewError(500, err.Error())
	}
	defer rows.Close()

	var movies []fiber.Map
	for rows.Next() {
		var id, tmdbID int
		var title, relDate, poster, mstatus string
		var budget, domGross, wwGross, rt, pts, projPts float64
		rows.Scan(&id, &tmdbID, &title, &relDate, &poster, &budget, &domGross, &wwGross, &rt, &mstatus, &pts, &projPts)
		movies = append(movies, fiber.Map{
			"id": id, "tmdb_id": tmdbID, "title": title, "release_date": relDate,
			"poster_url": poster, "budget": budget, "domestic_gross": domGross,
			"worldwide_gross": wwGross, "rt_score": rt, "status": mstatus,
			"points": pts, "projected_points": projPts,
		})
	}
	if movies == nil {
		movies = []fiber.Map{}
	}
	return c.JSON(movies)
}

func getMovie(c *fiber.Ctx) error {
	id, _ := strconv.Atoi(c.Params("id"))
	var m struct {
		ID, TmdbID                                int
		Title, ReleaseDate, PosterURL, Status     string
		Budget, DomGross, WWGross, RTScore        float64
	}
	err := db.QueryRow("SELECT id, tmdb_id, title, release_date, poster_url, budget, domestic_gross, worldwide_gross, rt_score, status FROM movies WHERE id = ?", id).
		Scan(&m.ID, &m.TmdbID, &m.Title, &m.ReleaseDate, &m.PosterURL, &m.Budget, &m.DomGross, &m.WWGross, &m.RTScore, &m.Status)
	if err != nil {
		return fiber.NewError(404, "Movie not found")
	}
	return c.JSON(fiber.Map{
		"id": m.ID, "tmdb_id": m.TmdbID, "title": m.Title, "release_date": m.ReleaseDate,
		"poster_url": m.PosterURL, "budget": m.Budget, "domestic_gross": m.DomGross,
		"worldwide_gross": m.WWGross, "rt_score": m.RTScore, "status": m.Status,
	})
}

// --- Standings ---

func getStandings(c *fiber.Ctx) error {
	leagueID, _ := strconv.Atoi(c.Params("id"))
	rows, _ := db.Query(`SELECT t.id, t.name, t.total_points, u.display_name, u.id,
		(SELECT COUNT(*) FROM roster r WHERE r.team_id = t.id) as roster_size
		FROM teams t JOIN users u ON u.id = t.user_id
		WHERE t.league_id = ? ORDER BY t.total_points DESC`, leagueID)
	defer rows.Close()

	var standings []fiber.Map
	rank := 1
	for rows.Next() {
		var tid, uid, rosterSize int
		var tname, uname string
		var pts float64
		rows.Scan(&tid, &tname, &pts, &uname, &uid, &rosterSize)
		standings = append(standings, fiber.Map{
			"rank": rank, "team_id": tid, "team_name": tname, "total_points": pts,
			"owner": uname, "user_id": uid, "roster_size": rosterSize,
		})
		rank++
	}
	if standings == nil {
		standings = []fiber.Map{}
	}
	return c.JSON(standings)
}

// --- Transactions ---

func getTransactions(c *fiber.Ctx) error {
	leagueID, _ := strconv.Atoi(c.Params("id"))
	rows, _ := db.Query(`SELECT tx.id, tx.team_id, tx.movie_id, tx.type, tx.created_at,
		t.name as team_name, m.title as movie_title
		FROM transactions tx
		JOIN teams t ON t.id = tx.team_id
		JOIN movies m ON m.id = tx.movie_id
		WHERE tx.league_id = ? ORDER BY tx.created_at DESC LIMIT 50`, leagueID)
	defer rows.Close()

	var txns []fiber.Map
	for rows.Next() {
		var id, teamID, movieID int
		var txType, createdAt, teamName, movieTitle string
		rows.Scan(&id, &teamID, &movieID, &txType, &createdAt, &teamName, &movieTitle)
		txns = append(txns, fiber.Map{
			"id": id, "team_id": teamID, "movie_id": movieID, "type": txType,
			"created_at": createdAt, "team_name": teamName, "movie_title": movieTitle,
		})
	}
	if txns == nil {
		txns = []fiber.Map{}
	}
	return c.JSON(txns)
}

// --- Trades ---

func createTrade(c *fiber.Ctx) error {
	userID := getUserID(c)
	var body struct {
		LeagueID       int   `json:"league_id"`
		ReceiverTeamID int   `json:"receiver_team_id"`
		OfferMovieIDs  []int `json:"offer_movie_ids"`
		RequestMovieIDs []int `json:"request_movie_ids"`
	}
	if err := c.BodyParser(&body); err != nil {
		return fiber.NewError(400, "Invalid request")
	}

	// Find proposer team
	var proposerTeamID int
	err := db.QueryRow("SELECT id FROM teams WHERE league_id = ? AND user_id = ?", body.LeagueID, userID).Scan(&proposerTeamID)
	if err != nil {
		return fiber.NewError(403, "You don't have a team in this league")
	}

	tx, _ := db.Begin()
	res, _ := tx.Exec("INSERT INTO trades (league_id, proposer_team_id, receiver_team_id) VALUES (?, ?, ?)",
		body.LeagueID, proposerTeamID, body.ReceiverTeamID)
	tradeID, _ := res.LastInsertId()

	for _, mid := range body.OfferMovieIDs {
		tx.Exec("INSERT INTO trade_items (trade_id, team_id, movie_id) VALUES (?, ?, ?)", tradeID, proposerTeamID, mid)
	}
	for _, mid := range body.RequestMovieIDs {
		tx.Exec("INSERT INTO trade_items (trade_id, team_id, movie_id) VALUES (?, ?, ?)", tradeID, body.ReceiverTeamID, mid)
	}
	tx.Commit()

	return c.Status(201).JSON(fiber.Map{"id": tradeID, "status": "pending"})
}

func acceptTrade(c *fiber.Ctx) error {
	tradeID, _ := strconv.Atoi(c.Params("id"))
	userID := getUserID(c)

	var receiverTeamID, leagueID, proposerTeamID int
	db.QueryRow("SELECT receiver_team_id, league_id, proposer_team_id FROM trades WHERE id = ? AND status = 'pending'", tradeID).
		Scan(&receiverTeamID, &leagueID, &proposerTeamID)

	var teamUserID int
	db.QueryRow("SELECT user_id FROM teams WHERE id = ?", receiverTeamID).Scan(&teamUserID)
	if teamUserID != userID {
		return fiber.NewError(403, "Only the receiving team can accept")
	}

	// Swap movies
	tx, _ := db.Begin()
	rows, _ := tx.Query("SELECT team_id, movie_id FROM trade_items WHERE trade_id = ?", tradeID)
	type item struct{ teamID, movieID int }
	var items []item
	for rows.Next() {
		var i item
		rows.Scan(&i.teamID, &i.movieID)
		items = append(items, i)
	}
	rows.Close()

	for _, it := range items {
		otherTeam := proposerTeamID
		if it.teamID == proposerTeamID {
			otherTeam = receiverTeamID
		}
		tx.Exec("DELETE FROM roster WHERE team_id = ? AND movie_id = ?", it.teamID, it.movieID)
		tx.Exec("INSERT OR IGNORE INTO roster (team_id, movie_id, acquisition_type) VALUES (?, ?, 'trade')", otherTeam, it.movieID)
		tx.Exec("INSERT INTO transactions (league_id, team_id, movie_id, type) VALUES (?, ?, ?, 'trade')", leagueID, otherTeam, it.movieID)
	}
	tx.Exec("UPDATE trades SET status = 'accepted' WHERE id = ?", tradeID)
	tx.Commit()

	return c.JSON(fiber.Map{"message": "Trade accepted"})
}

func rejectTrade(c *fiber.Ctx) error {
	tradeID, _ := strconv.Atoi(c.Params("id"))
	db.Exec("UPDATE trades SET status = 'rejected' WHERE id = ? AND status = 'pending'", tradeID)
	return c.JSON(fiber.Map{"message": "Trade rejected"})
}

// --- Waivers ---

func claimWaiver(c *fiber.Ctx) error {
	userID := getUserID(c)
	var body struct {
		LeagueID int `json:"league_id"`
		MovieID  int `json:"movie_id"`
		DropMovieID int `json:"drop_movie_id"`
	}
	if err := c.BodyParser(&body); err != nil {
		return fiber.NewError(400, "Invalid request")
	}

	var teamID int
	err := db.QueryRow("SELECT id FROM teams WHERE league_id = ? AND user_id = ?", body.LeagueID, userID).Scan(&teamID)
	if err != nil {
		return fiber.NewError(403, "No team in this league")
	}

	tx, _ := db.Begin()
	tx.Exec("INSERT INTO roster (team_id, movie_id, acquisition_type) VALUES (?, ?, 'waiver')", teamID, body.MovieID)
	tx.Exec("INSERT INTO transactions (league_id, team_id, movie_id, type) VALUES (?, ?, ?, 'waiver')", body.LeagueID, teamID, body.MovieID)
	if body.DropMovieID > 0 {
		tx.Exec("DELETE FROM roster WHERE team_id = ? AND movie_id = ?", teamID, body.DropMovieID)
		tx.Exec("INSERT INTO transactions (league_id, team_id, movie_id, type) VALUES (?, ?, ?, 'drop')", body.LeagueID, teamID, body.DropMovieID)
	}
	tx.Exec("INSERT INTO waiver_claims (league_id, team_id, movie_id, status) VALUES (?, ?, ?, 'claimed')", body.LeagueID, teamID, body.MovieID)
	tx.Commit()

	return c.JSON(fiber.Map{"message": "Waiver claim processed"})
}

func getLeagueWaivers(c *fiber.Ctx) error {
	leagueID, _ := strconv.Atoi(c.Params("id"))
	rows, _ := db.Query(`SELECT w.id, w.team_id, w.movie_id, w.status, w.claimed_at,
		t.name as team_name, m.title as movie_title
		FROM waiver_claims w
		JOIN teams t ON t.id = w.team_id
		JOIN movies m ON m.id = w.movie_id
		WHERE w.league_id = ? ORDER BY w.claimed_at DESC`, leagueID)
	defer rows.Close()

	var waivers []fiber.Map
	for rows.Next() {
		var id, teamID, movieID int
		var status, claimedAt, teamName, movieTitle string
		rows.Scan(&id, &teamID, &movieID, &status, &claimedAt, &teamName, &movieTitle)
		waivers = append(waivers, fiber.Map{
			"id": id, "team_id": teamID, "movie_id": movieID, "status": status,
			"claimed_at": claimedAt, "team_name": teamName, "movie_title": movieTitle,
		})
	}
	if waivers == nil {
		waivers = []fiber.Map{}
	}
	return c.JSON(waivers)
}

// --- Migrations ---

func runMigrations() {
	migrations := []string{
		"ALTER TABLE movies ADD COLUMN points REAL NOT NULL DEFAULT 0",
		"ALTER TABLE movies ADD COLUMN projected_points REAL NOT NULL DEFAULT 0",
		"ALTER TABLE movies ADD COLUMN opening_weekend_gross REAL NOT NULL DEFAULT 0",
		"ALTER TABLE leagues ADD COLUMN invite_code TEXT",
	}
	for _, m := range migrations {
		db.Exec(m) // ignore errors (column already exists)
	}
	// Separate index creation (SQLite can't do UNIQUE in ALTER TABLE)
	db.Exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_leagues_invite_code ON leagues(invite_code)")
	// Create chat and notifications tables
	db.Exec(`CREATE TABLE IF NOT EXISTS league_messages (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		league_id INTEGER NOT NULL REFERENCES leagues(id),
		user_id INTEGER NOT NULL REFERENCES users(id),
		message TEXT NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	)`)
	db.Exec(`CREATE TABLE IF NOT EXISTS notifications (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL REFERENCES users(id),
		type TEXT NOT NULL,
		title TEXT NOT NULL,
		body TEXT NOT NULL DEFAULT '',
		league_id INTEGER,
		read BOOLEAN NOT NULL DEFAULT 0,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	)`)
}

// --- Scheduled Sync ---

func scheduledSync() {
	log.Println("Starting scheduled TMDB sync (every 6 hours)")
	ticker := time.NewTicker(6 * time.Hour)
	defer ticker.Stop()
	for {
		<-ticker.C
		log.Println("Running scheduled TMDB sync...")
		runSyncAndScore()
	}
}

func runSyncAndScore() {
	// Track upcoming movies before sync for opening weekend detection
	upcomingBefore := make(map[int]bool)
	rows, _ := db.Query("SELECT tmdb_id FROM movies WHERE status = 'upcoming'")
	if rows != nil {
		for rows.Next() {
			var tid int
			rows.Scan(&tid)
			upcomingBefore[tid] = true
		}
		rows.Close()
	}

	// Run TMDB sync inline
	upcoming, err1 := tmdbFetchList("/movie/upcoming")
	nowPlaying, err2 := tmdbFetchList("/movie/now_playing")
	if err1 != nil && err2 != nil {
		log.Println("Sync failed: could not fetch TMDB")
		return
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

		// RT score proxy: vote_average * 10
		rtScore := 0.0
		if details.Runtime > 0 { // has details
			// Use vote_average from TMDB as RT proxy
		}

		res, _ := db.Exec(`UPDATE movies SET title=?, release_date=?, poster_url=?, budget=?, domestic_gross=?, worldwide_gross=?, status=?
			WHERE tmdb_id=?`,
			m.Title, m.ReleaseDate, poster, budget, revenue, revenue, status, m.ID)
		rowsAff, _ := res.RowsAffected()
		if rowsAff == 0 {
			db.Exec(`INSERT INTO movies (tmdb_id, title, release_date, poster_url, budget, domestic_gross, worldwide_gross, status)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
				m.ID, m.Title, m.ReleaseDate, poster, budget, revenue, revenue, status)
		}

		// Opening weekend detection
		if upcomingBefore[m.ID] && status == "released" && revenue > 0 {
			db.Exec("UPDATE movies SET opening_weekend_gross = ? WHERE tmdb_id = ? AND opening_weekend_gross = 0", revenue, m.ID)
			log.Printf("Detected opening weekend for %s: $%.0f", m.Title, revenue)
		}

		// RT score proxy
		_ = rtScore
		synced++
	}

	// Update RT scores using TMDB vote_average
	updateRTScores()

	// Update projections
	updateProjections()

	// Recalculate scores
	recalculateAllScores()

	log.Printf("Scheduled sync complete: %d movies synced", synced)
}

func updateRTScores() {
	rows, err := db.Query("SELECT id, tmdb_id FROM movies")
	if err != nil {
		return
	}
	defer rows.Close()

	type mid struct{ id, tmdbID int }
	var movies []mid
	for rows.Next() {
		var m mid
		rows.Scan(&m.id, &m.tmdbID)
		movies = append(movies, m)
	}

	for _, m := range movies {
		data, err := tmdbGet(fmt.Sprintf("/movie/%d", m.tmdbID))
		if err != nil {
			continue
		}
		var detail struct {
			VoteAverage float64 `json:"vote_average"`
		}
		if err := json.Unmarshal(data, &detail); err != nil {
			continue
		}
		rtProxy := detail.VoteAverage * 10 // 0-100 scale
		db.Exec("UPDATE movies SET rt_score = ? WHERE id = ?", rtProxy, m.id)
	}
}

func updateProjections() {
	rows, err := db.Query("SELECT id, budget FROM movies WHERE status = 'upcoming'")
	if err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		var id int
		var budget float64
		rows.Scan(&id, &budget)

		// Simple heuristic: projected gross = budget * 2.5
		projectedGross := budget * 2.5
		// Apply scoring: domestic ~ 40% of worldwide, opening ~ 35% of domestic
		domestic := projectedGross * 0.4
		opening := domestic * 0.35
		worldwide := projectedGross

		projected := opening/1_000_000 + domestic/1_000_000*0.5 + worldwide/1_000_000*0.25
		if domestic >= 100_000_000 {
			projected += 20
		}
		if worldwide >= 500_000_000 {
			projected += 50
		}

		db.Exec("UPDATE movies SET projected_points = ? WHERE id = ?", projected, id)
	}
}

// --- League Invites ---

func getLeagueInvite(c *fiber.Ctx) error {
	leagueID, _ := strconv.Atoi(c.Params("id"))

	var code sql.NullString
	db.QueryRow("SELECT invite_code FROM leagues WHERE id = ?", leagueID).Scan(&code)
	if !code.Valid || code.String == "" {
		newCode := uuid.New().String()
		db.Exec("UPDATE leagues SET invite_code = ? WHERE id = ?", newCode, leagueID)
		code.String = newCode
	}
	return c.JSON(fiber.Map{"invite_code": code.String})
}

func authMiddlewareOptional(c *fiber.Ctx) error {
	auth := c.Get("Authorization")
	if strings.HasPrefix(auth, "Bearer ") {
		tokenStr := strings.TrimPrefix(auth, "Bearer ")
		token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
			return jwtSecret, nil
		})
		if err == nil && token.Valid {
			claims := token.Claims.(jwt.MapClaims)
			c.Locals("user_id", int(claims["user_id"].(float64)))
		}
	}
	return c.Next()
}

func joinLeagueByInvite(c *fiber.Ctx) error {
	code := c.Params("code")
	userIDVal := c.Locals("user_id")
	if userIDVal == nil {
		return fiber.NewError(401, "Authentication required")
	}
	userID := userIDVal.(int)

	var leagueID, maxTeams int
	var status string
	err := db.QueryRow("SELECT id, max_teams, status FROM leagues WHERE invite_code = ?", code).Scan(&leagueID, &maxTeams, &status)
	if err != nil {
		return fiber.NewError(404, "Invalid invite code")
	}
	if status != "pending" {
		return fiber.NewError(400, "League is not accepting new teams")
	}

	var count int
	db.QueryRow("SELECT COUNT(*) FROM teams WHERE league_id = ?", leagueID).Scan(&count)
	if count >= maxTeams {
		return fiber.NewError(400, "League is full")
	}

	var body struct {
		TeamName string `json:"team_name"`
	}
	c.BodyParser(&body)
	if body.TeamName == "" {
		body.TeamName = "My Team"
	}

	_, err = db.Exec("INSERT INTO teams (league_id, user_id, name) VALUES (?, ?, ?)", leagueID, userID, body.TeamName)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE") {
			return fiber.NewError(409, "Already in this league")
		}
		return fiber.NewError(500, err.Error())
	}
	return c.JSON(fiber.Map{"message": "Joined league", "league_id": leagueID})
}

// --- Movie Projections ---

func getMovieProjection(c *fiber.Ctx) error {
	id, _ := strconv.Atoi(c.Params("id"))

	var budget, domestic, worldwide, opening, points, projPoints float64
	var title, status string
	err := db.QueryRow("SELECT title, budget, domestic_gross, worldwide_gross, opening_weekend_gross, points, projected_points, status FROM movies WHERE id = ?", id).
		Scan(&title, &budget, &domestic, &worldwide, &opening, &points, &projPoints, &status)
	if err != nil {
		return fiber.NewError(404, "Movie not found")
	}

	// Build projection breakdown
	projGross := budget * 2.5
	projDomestic := projGross * 0.4
	projOpening := projDomestic * 0.35
	projWorldwide := projGross

	return c.JSON(fiber.Map{
		"movie_id":             id,
		"title":                title,
		"status":               status,
		"current_points":       points,
		"projected_points":     projPoints,
		"budget":               budget,
		"projected_domestic":   projDomestic,
		"projected_worldwide":  projWorldwide,
		"projected_opening":    projOpening,
		"actual_domestic":      domestic,
		"actual_worldwide":     worldwide,
		"actual_opening":       opening,
	})
}

// --- Trade Analyzer ---

func analyzeTrade(c *fiber.Ctx) error {
	var body struct {
		Give    []int `json:"give"`
		Receive []int `json:"receive"`
	}
	if err := c.BodyParser(&body); err != nil {
		return fiber.NewError(400, "Invalid request")
	}

	getPoints := func(ids []int) (float64, float64) {
		var pts, proj float64
		for _, id := range ids {
			var p, pp float64
			db.QueryRow("SELECT points, projected_points FROM movies WHERE id = ?", id).Scan(&p, &pp)
			pts += p
			proj += pp
		}
		return pts, proj
	}

	givePts, giveProj := getPoints(body.Give)
	recvPts, recvProj := getPoints(body.Receive)

	diff := recvPts - givePts
	projDiff := recvProj - giveProj

	rec := "neutral"
	if projDiff > 10 {
		rec = "strong_accept"
	} else if projDiff > 0 {
		rec = "lean_accept"
	} else if projDiff < -10 {
		rec = "strong_reject"
	} else if projDiff < 0 {
		rec = "lean_reject"
	}

	return c.JSON(fiber.Map{
		"give_points":          givePts,
		"receive_points":       recvPts,
		"point_difference":     diff,
		"give_projected":       giveProj,
		"receive_projected":    recvProj,
		"projected_difference": projDiff,
		"recommendation":       rec,
	})
}

// --- Seed Data ---

func seedMovies() {
	var count int
	db.QueryRow("SELECT COUNT(*) FROM movies").Scan(&count)
	if count > 0 {
		return
	}
	fmt.Println("Seeding movies...")
	movies := []struct {
		tmdbID int
		title  string
		date   string
		budget float64
		status string
	}{
		{293660, "Deadpool & Wolverine", "2024-07-26", 200000000, "released"},
		{533535, "Joker: Folie à Deux", "2024-10-04", 200000000, "released"},
		{698687, "Transformers One", "2024-09-20", 75000000, "released"},
		{1184918, "The Wild Robot", "2024-09-27", 78000000, "released"},
		{912649, "Venom: The Last Dance", "2024-10-25", 120000000, "released"},
		{558449, "Gladiator II", "2024-11-22", 250000000, "released"},
		{1241982, "Moana 2", "2024-11-27", 150000000, "released"},
		{939243, "Sonic the Hedgehog 3", "2024-12-20", 122000000, "released"},
		{1022789, "Inside Out 2", "2024-06-14", 200000000, "released"},
		{823464, "Godzilla x Kong: The New Empire", "2024-03-29", 135000000, "released"},
		{1011985, "Kung Fu Panda 4", "2024-03-08", 85000000, "released"},
		{573435, "Bad Boys: Ride or Die", "2024-06-07", 100000000, "released"},
		{653346, "Kingdom of the Planet of the Apes", "2024-05-10", 160000000, "released"},
		{762441, "A Quiet Place: Day One", "2024-06-28", 67000000, "released"},
		{519182, "Despicable Me 4", "2024-07-03", 100000000, "released"},
		{786892, "Furiosa: A Mad Max Saga", "2024-05-24", 168000000, "released"},
		{748783, "The Garfield Movie", "2024-05-24", 60000000, "released"},
		{1064028, "Beetlejuice Beetlejuice", "2024-09-06", 100000000, "released"},
		{945961, "Alien: Romulus", "2024-08-16", 80000000, "released"},
		{402431, "Wicked", "2024-11-22", 150000000, "released"},
		// 2025 upcoming
		{447273, "Snow White", "2025-03-21", 270000000, "upcoming"},
		{986056, "Thunderbolts*", "2025-05-02", 200000000, "upcoming"},
		{835113, "Lilo & Stitch", "2025-05-23", 200000000, "upcoming"},
		{1001311, "28 Years Later", "2025-06-20", 75000000, "upcoming"},
		{726139, "Jurassic World Rebirth", "2025-07-02", 200000000, "upcoming"},
		{566810, "Superman", "2025-07-11", 250000000, "upcoming"},
		{950387, "The Fantastic Four: First Steps", "2025-07-25", 250000000, "upcoming"},
		{845781, "How to Train Your Dragon", "2025-06-13", 150000000, "upcoming"},
		{696506, "Mission: Impossible – The Final Reckoning", "2025-05-23", 300000000, "upcoming"},
		{592983, "Zootopia 2", "2025-11-26", 175000000, "upcoming"},
		{1233069, "Elio", "2025-06-13", 175000000, "upcoming"},
		{447365, "Guardians of the Galaxy Vol. 4", "2025-08-01", 200000000, "upcoming"},
		{614933, "Avatar 3", "2025-12-19", 350000000, "upcoming"},
		{399566, "The Smurfs Movie", "2025-02-14", 80000000, "upcoming"},
		{1159311, "Karate Kid: Legends", "2025-05-30", 80000000, "upcoming"},
		{1168312, "A Minecraft Movie", "2025-04-04", 150000000, "upcoming"},
		{837196, "The Amateur", "2025-04-11", 30000000, "upcoming"},
		{986241, "Sinners", "2025-04-18", 90000000, "upcoming"},
		{1197306, "Novocaine", "2025-03-14", 35000000, "upcoming"},
		{1114894, "Star Wars: The Mandalorian & Grogu", "2025-05-22", 250000000, "upcoming"},
	}

	for _, m := range movies {
		poster := fmt.Sprintf("https://image.tmdb.org/t/p/w500/%d.jpg", m.tmdbID)
		db.Exec("INSERT INTO movies (tmdb_id, title, release_date, poster_url, budget, status) VALUES (?, ?, ?, ?, ?, ?)",
			m.tmdbID, m.title, m.date, poster, m.budget, m.status)
	}
	fmt.Printf("Seeded %d movies\n", len(movies))
}
