CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL DEFAULT '',
    avatar_url TEXT NOT NULL DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS leagues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    owner_id INTEGER NOT NULL REFERENCES users(id),
    season_year INTEGER NOT NULL,
    draft_date DATETIME,
    max_teams INTEGER NOT NULL DEFAULT 8,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','drafting','active','completed'))
);

CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    league_id INTEGER NOT NULL REFERENCES leagues(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    total_points REAL NOT NULL DEFAULT 0,
    UNIQUE(league_id, user_id)
);

CREATE TABLE IF NOT EXISTS movies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tmdb_id INTEGER UNIQUE,
    title TEXT NOT NULL,
    release_date TEXT,
    poster_url TEXT NOT NULL DEFAULT '',
    budget REAL NOT NULL DEFAULT 0,
    domestic_gross REAL NOT NULL DEFAULT 0,
    worldwide_gross REAL NOT NULL DEFAULT 0,
    rt_score REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'upcoming' CHECK(status IN ('upcoming','released','free_agent'))
);

CREATE TABLE IF NOT EXISTS roster (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id INTEGER NOT NULL REFERENCES teams(id),
    movie_id INTEGER NOT NULL REFERENCES movies(id),
    acquired_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    acquisition_type TEXT NOT NULL DEFAULT 'draft' CHECK(acquisition_type IN ('draft','waiver','trade')),
    UNIQUE(team_id, movie_id)
);

CREATE TABLE IF NOT EXISTS draft_picks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    league_id INTEGER NOT NULL REFERENCES leagues(id),
    round INTEGER NOT NULL,
    pick_number INTEGER NOT NULL,
    team_id INTEGER NOT NULL REFERENCES teams(id),
    movie_id INTEGER REFERENCES movies(id)
);

CREATE TABLE IF NOT EXISTS trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    league_id INTEGER NOT NULL REFERENCES leagues(id),
    proposer_team_id INTEGER NOT NULL REFERENCES teams(id),
    receiver_team_id INTEGER NOT NULL REFERENCES teams(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected')),
    proposed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS trade_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trade_id INTEGER NOT NULL REFERENCES trades(id),
    team_id INTEGER NOT NULL REFERENCES teams(id),
    movie_id INTEGER NOT NULL REFERENCES movies(id)
);

CREATE TABLE IF NOT EXISTS waiver_claims (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    league_id INTEGER NOT NULL REFERENCES leagues(id),
    team_id INTEGER NOT NULL REFERENCES teams(id),
    movie_id INTEGER NOT NULL REFERENCES movies(id),
    priority INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    claimed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    league_id INTEGER NOT NULL REFERENCES leagues(id),
    team_id INTEGER NOT NULL REFERENCES teams(id),
    movie_id INTEGER NOT NULL REFERENCES movies(id),
    type TEXT NOT NULL CHECK(type IN ('draft','waiver','trade','drop')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- New columns (ALTERs are idempotent via IF NOT EXISTS workaround)
-- We use CREATE TABLE IF NOT EXISTS for new tables, and handle ALTER via init code

CREATE TABLE IF NOT EXISTS league_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    league_id INTEGER NOT NULL REFERENCES leagues(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    league_id INTEGER NOT NULL DEFAULT 0,
    read BOOLEAN NOT NULL DEFAULT false,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
