import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAuth } from '../lib/auth';
import { useToast } from '../components/Toast';

interface Pick {
  pick_number: number;
  round: number;
  team_id: number;
  team_name: string;
  movie_id?: number;
  movie_title?: string;
  poster_url?: string;
}

type SortKey = 'title' | 'projected_points' | 'budget' | 'release_date';

export default function DraftRoom() {
  const { id } = useParams();
  const leagueId = parseInt(id!);
  const { user } = useAuth();
  const { addToast } = useToast();

  const [draftStatus, setDraftStatus] = useState<any>(null);
  const [movies, setMovies] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('projected_points');
  const [confirmMovie, setConfirmMovie] = useState<any>(null);
  const [picking, setPicking] = useState(false);
  const [timeLeft, setTimeLeft] = useState(90);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  // Load initial state
  useEffect(() => {
    api.getDraftStatus(leagueId).then(setDraftStatus);
    api.getMovies({ status: 'upcoming' }).then(setMovies);
  }, [leagueId]);

  const handleWsMessage = useCallback((data: any) => {
    switch (data.type) {
      case 'pick_made':
        setDraftStatus((prev: any) => prev ? {
          ...prev,
          current_pick: data.next_pick,
          picks: prev.picks.map((p: Pick) =>
            p.pick_number === data.pick_number
              ? { ...p, movie_id: data.movie_id, movie_title: data.movie_title, poster_url: data.poster_url }
              : p
          ),
        } : prev);
        addToast(`${data.team_name} drafted ${data.movie_title}!`, 'info');
        setTimeLeft(90);
        break;
      case 'timer_update':
        setTimeLeft(data.seconds_left);
        break;
      case 'draft_complete':
        setDraftStatus((prev: any) => prev ? { ...prev, status: 'complete' } : prev);
        addToast('Draft is complete! 🎉', 'success');
        break;
      case 'status_update':
        setDraftStatus(data.status);
        break;
    }
  }, [addToast]);

  const { status: wsStatus, send } = useWebSocket(`/ws/draft/${leagueId}`, handleWsMessage);

  // Local countdown
  useEffect(() => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  const makePick = async (movieId: number) => {
    setPicking(true);
    try {
      await api.makePick(leagueId, movieId);
      send({ type: 'pick', movie_id: movieId });
    } catch (err: any) {
      addToast(err.message, 'error');
    }
    setPicking(false);
    setConfirmMovie(null);
  };

  if (!draftStatus) {
    return (
      <div className="draft-room">
        <div className="skeleton"><div className="skeleton-line" style={{ height: '2rem', width: '40%' }} /><div className="skeleton-line" style={{ height: '400px' }} /></div>
      </div>
    );
  }

  const picks: Pick[] = draftStatus.picks || [];
  const pickedMovieIds = new Set(picks.filter(p => p.movie_id).map(p => p.movie_id));
  const availableMovies = movies
    .filter(m => !pickedMovieIds.has(m.id) && m.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      switch (sortBy) {
        case 'title': return a.title.localeCompare(b.title);
        case 'projected_points': return (b.projected_points || 0) - (a.projected_points || 0);
        case 'budget': return (b.budget || 0) - (a.budget || 0);
        case 'release_date': return (a.release_date || '').localeCompare(b.release_date || '');
        default: return 0;
      }
    });

  const teams = [...new Map(picks.map(p => [p.team_name, p.team_id])).entries()].map(([name, teamId]) => ({ name, teamId }));
  const maxRound = Math.max(...picks.map(p => p.round), 1);
  const rounds = Array.from({ length: maxRound }, (_, i) => i + 1);
  const currentPick = picks.find(p => p.pick_number === draftStatus.current_pick);
  const isMyTurn = currentPick && user && picks.some(p => p.pick_number === draftStatus.current_pick && p.team_name === user.display_name);
  const myPicks = picks.filter(p => p.movie_id && p.team_name === user?.display_name);
  const timerPct = (timeLeft / 90) * 100;
  const fmt = (n: number) => n >= 1e9 ? `$${(n/1e9).toFixed(1)}B` : n >= 1e6 ? `$${(n/1e6).toFixed(1)}M` : `$${n.toLocaleString()}`;

  return (
    <div className="draft-room">
      {/* Header */}
      <div className="draft-header">
        <div className="draft-header-left">
          <h1>🎬 Draft Room</h1>
          <span className={`ws-status ${wsStatus}`}>
            {wsStatus === 'connected' ? '🟢' : wsStatus === 'reconnecting' ? '🟡' : '🔴'} {wsStatus}
          </span>
        </div>
        {currentPick && !currentPick.movie_id && (
          <div className="draft-clock">
            <div className="draft-clock-info">
              <span className="pick-label">Pick #{draftStatus.current_pick}</span>
              <strong className={isMyTurn ? 'your-turn' : ''}>{isMyTurn ? "YOUR PICK!" : currentPick.team_name}</strong>
            </div>
            <div className="timer-bar-container">
              <div
                className={`timer-bar ${timeLeft <= 15 ? 'urgent' : timeLeft <= 30 ? 'warning' : ''}`}
                style={{ width: `${timerPct}%` }}
              />
            </div>
            <span className="timer-text">{timeLeft}s</span>
            {timeLeft <= 10 && <span className="auto-pick-warning">⚠️ Auto-pick soon</span>}
          </div>
        )}
      </div>

      {/* Snake Draft Order */}
      <div className="draft-snake-order">
        {teams.map((t, i) => (
          <span key={t.name} className={`snake-team ${currentPick?.team_name === t.name ? 'active' : ''}`}>
            {i + 1}. {t.name}
          </span>
        ))}
      </div>

      <div className="draft-layout">
        {/* Available Movies */}
        <div className="draft-available">
          <h2>Available Movies ({availableMovies.length})</h2>
          <div className="draft-controls">
            <input
              type="text"
              placeholder="Search movies..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="search-input"
            />
            <select value={sortBy} onChange={e => setSortBy(e.target.value as SortKey)} className="sort-select">
              <option value="projected_points">Projected Points</option>
              <option value="title">Title</option>
              <option value="budget">Budget</option>
              <option value="release_date">Release Date</option>
            </select>
          </div>
          <div className="movie-grid">
            {availableMovies.map(m => (
              <div key={m.id} className="draft-movie-card" onClick={() => setConfirmMovie(m)}>
                <img
                  src={m.poster_url || `https://via.placeholder.com/150x225/1a1a2e/e0d68a?text=${encodeURIComponent(m.title)}`}
                  alt={m.title}
                  onError={(e) => { (e.target as HTMLImageElement).src = `https://via.placeholder.com/150x225/1a1a2e/e0d68a?text=${encodeURIComponent(m.title)}`; }}
                />
                <div className="draft-movie-info">
                  <h4>{m.title}</h4>
                  <span className="date">{m.release_date || 'TBA'}</span>
                  {m.budget > 0 && <span className="budget">{fmt(m.budget)}</span>}
                  {m.projected_points != null && (
                    <span className="proj-pts">{m.projected_points.toFixed(1)} proj pts</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Draft Board */}
        <div className="draft-board-container">
          <h2>Draft Board</h2>
          <div className="draft-board">
            <table>
              <thead>
                <tr>
                  <th>Rd</th>
                  {teams.map(t => <th key={t.name}>{t.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {rounds.map(round => (
                  <tr key={round}>
                    <td className="round-num">{round}</td>
                    {teams.map(t => {
                      const pick = picks.find(p => p.round === round && p.team_name === t.name);
                      const isCurrent = pick?.pick_number === draftStatus.current_pick && !pick?.movie_id;
                      return (
                        <td key={t.name} className={`draft-cell ${isCurrent ? 'current' : ''} ${pick?.movie_id ? 'picked' : ''}`}>
                          {pick?.movie_id ? (
                            <div className="board-pick">
                              {pick.poster_url && <img src={pick.poster_url} alt="" className="board-poster" />}
                              <span>{pick.movie_title}</span>
                            </div>
                          ) : isCurrent ? '⏳' : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* My Roster Sidebar */}
        <div className="draft-roster-sidebar">
          <h2>My Roster ({myPicks.length})</h2>
          {myPicks.length === 0 ? (
            <p className="empty">No picks yet</p>
          ) : (
            <div className="roster-mini-list">
              {myPicks.map(p => (
                <div key={p.pick_number} className="roster-mini-item">
                  {p.poster_url && <img src={p.poster_url} alt="" />}
                  <div>
                    <strong>{p.movie_title}</strong>
                    <span>Round {p.round}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Confirm Pick Dialog */}
      {confirmMovie && (
        <div className="modal-overlay" onClick={() => setConfirmMovie(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Confirm Pick</h2>
            <div className="confirm-movie">
              <img
                src={confirmMovie.poster_url || `https://via.placeholder.com/200x300/1a1a2e/e0d68a?text=${encodeURIComponent(confirmMovie.title)}`}
                alt={confirmMovie.title}
                onError={(e) => { (e.target as HTMLImageElement).src = `https://via.placeholder.com/200x300/1a1a2e/e0d68a?text=${encodeURIComponent(confirmMovie.title)}`; }}
              />
              <div>
                <h3>{confirmMovie.title}</h3>
                <p>Release: {confirmMovie.release_date || 'TBA'}</p>
                {confirmMovie.budget > 0 && <p>Budget: {fmt(confirmMovie.budget)}</p>}
                {confirmMovie.projected_points != null && <p>Projected: {confirmMovie.projected_points.toFixed(1)} pts</p>}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => makePick(confirmMovie.id)} disabled={picking}>
                {picking ? 'Drafting...' : 'Draft This Movie'}
              </button>
              <button className="btn btn-secondary" onClick={() => setConfirmMovie(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
