import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import DraftBoard from '../components/DraftBoard';
import MovieCard from '../components/MovieCard';

export default function DraftRoom() {
  const { id } = useParams();
  const leagueId = parseInt(id!);
  const [draftStatus, setDraftStatus] = useState<any>(null);
  const [movies, setMovies] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [picking, setPicking] = useState(false);

  const loadDraft = useCallback(async () => {
    const status = await api.getDraftStatus(leagueId);
    setDraftStatus(status);
  }, [leagueId]);

  useEffect(() => {
    loadDraft();
    api.getMovies({ status: 'upcoming' }).then(setMovies);
    const interval = setInterval(loadDraft, 5000);
    return () => clearInterval(interval);
  }, [loadDraft]);

  const makePick = async (movieId: number) => {
    setPicking(true);
    try {
      await api.makePick(leagueId, movieId);
      await loadDraft();
    } catch (err: any) {
      alert(err.message);
    }
    setPicking(false);
  };

  if (!draftStatus) return <div className="loading">Loading draft...</div>;

  const pickedMovieIds = new Set(draftStatus.picks?.filter((p: any) => p.movie_id).map((p: any) => p.movie_id));
  const availableMovies = movies.filter(m =>
    !pickedMovieIds.has(m.id) && m.title.toLowerCase().includes(search.toLowerCase())
  );

  const teamNames = [...new Set(draftStatus.picks?.map((p: any) => p.team_name) || [])];

  return (
    <div className="draft-room">
      <div className="draft-header">
        <h1>🎬 Draft Room</h1>
        {draftStatus.current_pick > 0 && (
          <div className="current-pick-info">
            Pick #{draftStatus.current_pick} — On the clock:{' '}
            <strong>{draftStatus.picks?.find((p: any) => p.pick_number === draftStatus.current_pick)?.team_name}</strong>
          </div>
        )}
      </div>

      <div className="draft-layout">
        <div className="draft-available">
          <h2>Available Movies</h2>
          <input
            type="text"
            placeholder="Search movies..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="search-input"
          />
          <div className="movie-grid">
            {availableMovies.map(m => (
              <MovieCard
                key={m.id}
                movie={m}
                action={
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={(e) => { e.stopPropagation(); makePick(m.id); }}
                    disabled={picking}
                  >
                    Draft
                  </button>
                }
              />
            ))}
          </div>
        </div>

        <div className="draft-board-container">
          <h2>Draft Board</h2>
          <DraftBoard
            picks={draftStatus.picks || []}
            teams={teamNames as string[]}
            currentPick={draftStatus.current_pick}
          />
        </div>
      </div>
    </div>
  );
}
