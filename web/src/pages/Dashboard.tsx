import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import LeagueCard from '../components/LeagueCard';

export default function Dashboard() {
  const [leagues, setLeagues] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [newLeague, setNewLeague] = useState({ name: '', season_year: 2025, max_teams: 8, team_name: '' });
  const [joinId, setJoinId] = useState('');
  const [joinTeamName, setJoinTeamName] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { loadLeagues(); }, []);

  const loadLeagues = async () => {
    try { setLeagues(await api.getLeagues()); } catch {}
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const league = await api.createLeague(newLeague);
      setShowCreate(false);
      navigate(`/league/${league.id}`);
    } catch {}
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.joinLeague(parseInt(joinId), joinTeamName);
      setShowJoin(false);
      loadLeagues();
    } catch {}
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Welcome, {user?.display_name || 'Player'}!</h1>
        <div className="dashboard-actions">
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>Create League</button>
          <button className="btn btn-secondary" onClick={() => setShowJoin(true)}>Join League</button>
        </div>
      </div>

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Create League</h2>
            <form onSubmit={handleCreate}>
              <input placeholder="League Name" value={newLeague.name} onChange={e => setNewLeague({ ...newLeague, name: e.target.value })} required />
              <input placeholder="Your Team Name" value={newLeague.team_name} onChange={e => setNewLeague({ ...newLeague, team_name: e.target.value })} />
              <input type="number" placeholder="Season Year" value={newLeague.season_year} onChange={e => setNewLeague({ ...newLeague, season_year: parseInt(e.target.value) })} />
              <input type="number" placeholder="Max Teams" value={newLeague.max_teams} onChange={e => setNewLeague({ ...newLeague, max_teams: parseInt(e.target.value) })} min={2} max={12} />
              <button className="btn btn-primary" type="submit">Create</button>
            </form>
          </div>
        </div>
      )}

      {showJoin && (
        <div className="modal-overlay" onClick={() => setShowJoin(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Join League</h2>
            <form onSubmit={handleJoin}>
              <input placeholder="League ID" value={joinId} onChange={e => setJoinId(e.target.value)} required />
              <input placeholder="Your Team Name" value={joinTeamName} onChange={e => setJoinTeamName(e.target.value)} />
              <button className="btn btn-primary" type="submit">Join</button>
            </form>
          </div>
        </div>
      )}

      <section>
        <h2>My Leagues</h2>
        {leagues.length === 0 ? (
          <p className="empty">No leagues yet. Create one or join an existing league!</p>
        ) : (
          <div className="leagues-grid">
            {leagues.map(l => (
              <LeagueCard key={l.id} league={l} onClick={() => navigate(`/league/${l.id}`)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
