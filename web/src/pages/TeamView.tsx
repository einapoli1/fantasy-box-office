import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import RosterList from '../components/RosterList';
import ShareButton from '../components/ShareButton';
import Skeleton from '../components/Skeleton';

export default function TeamView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [team, setTeam] = useState<any>(null);
  const [roster, setRoster] = useState<any[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const teamId = parseInt(id!);
    Promise.all([
      api.getTeam(teamId).then(setTeam),
      api.getTeamRoster(teamId).then(setRoster),
    ]).catch(e => setError(e.message));
  }, [id]);

  if (error) return (
    <div className="team-view">
      <div className="error-state">
        <p>Failed to load team: {error}</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>Retry</button>
      </div>
    </div>
  );

  if (!team) return <div className="team-view"><Skeleton lines={6} /></div>;

  return (
    <div className="team-view">
      <div className="team-header-row">
        <h1>{team.name}</h1>
        <ShareButton
          title={`${team.name} - Fantasy Box Office`}
          text={`Check out my team "${team.name}" with ${team.total_points.toFixed(1)} pts on Fantasy Box Office!`}
        />
      </div>
      <div className="team-stats">
        <div className="stat"><span className="stat-value">{team.total_points.toFixed(1)}</span><span className="stat-label">Total Points</span></div>
        <div className="stat"><span className="stat-value">{roster.length}</span><span className="stat-label">Movies</span></div>
      </div>
      <h2>Roster</h2>
      {roster.length === 0 ? (
        <p className="empty">No movies on roster yet. Time to draft or pick up free agents!</p>
      ) : (
        <RosterList roster={roster} onMovieClick={(mid) => navigate(`/movie/${mid}`)} />
      )}
    </div>
  );
}
