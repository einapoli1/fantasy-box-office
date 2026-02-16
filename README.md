# 🎬 Fantasy Box Office

Fantasy sports, but for movies. Draft upcoming films, compete based on real box office performance.

## How It Works

1. **Create or join a league** (4-12 players)
2. **Snake draft** upcoming movies for the year
3. **Earn points** based on real box office performance
4. **Trade & waiver wire** — pick up surprise hits mid-season
5. **Season runs Jan-Dec** — final standings after year-end

## Scoring System

| Metric | Points |
|--------|--------|
| $1M domestic opening weekend | 1 pt |
| $1M total domestic gross | 0.5 pts |
| $1M worldwide gross | 0.25 pts |
| Rotten Tomatoes 75%+ | +10 bonus |
| #1 opening weekend | +15 bonus |
| $100M+ domestic total | +20 bonus |
| $500M+ worldwide | +50 bonus |
| Flop (budget > 2x gross) | -10 penalty |

## Tech Stack

- **Backend**: Go + Fiber + SQLite (port 8090)
- **Web**: React + TypeScript + Vite
- **Mobile**: React Native + Expo
- **Shared**: TypeScript types & utilities

## Setup

### Backend
```bash
cd backend
go mod tidy
go run .
```

### Web
```bash
cd web
npm install
npm run dev
```

### Mobile
```bash
cd mobile
npm install
npx expo start
```

## Project Structure
```
fantasy-box-office/
├── backend/       # Go API server
├── shared/        # TypeScript types & utilities
├── web/           # React web app (Vite)
└── mobile/        # React Native (Expo)
```
