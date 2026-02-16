import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import RosterList from '../components/RosterList';

export default function TeamView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [team, setTeam] = useState<any>(null);
  const [roster, setRoster] = useState<any[]>([]);

  useEffect(() => {
    const teamId = parseInt(id!);
    api.getTeam(teamId).then(setTeam);
    api.getTeamRoster(teamId).then(setRoster);
  }, [id]);

  if (!team) return <div className="loading">Loading...</div>;

  return (
    <div className="team-view">
      <h1>{team.name}</h1>
      <div className="team-stats">
        <div className="stat"><span className="stat-value">{team.total_points.toFixed(1)}</span><span className="stat-label">Total Points</span></div>
        <div className="stat"><span className="stat-value">{roster.length}</span><span className="stat-label">Movies</span></div>
      </div>
      <h2>Roster</h2>
      <RosterList roster={roster} onMovieClick={(mid) => navigate(`/movie/${mid}`)} />
    </div>
  );
}
