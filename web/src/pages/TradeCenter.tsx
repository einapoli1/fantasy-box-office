import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';

export default function TradeCenter() {
  const { id } = useParams();
  const leagueId = parseInt(id!);
  const [waivers, setWaivers] = useState<any[]>([]);

  useEffect(() => {
    api.getLeagueWaivers(leagueId).then(setWaivers).catch(() => {});
  }, [leagueId]);

  return (
    <div className="trade-center">
      <h1>Trade Center</h1>
      <p className="subtitle">Propose trades with other teams in your league.</p>

      <section>
        <h2>Recent Trades</h2>
        {waivers.length === 0 ? (
          <p className="empty">No trade activity yet</p>
        ) : (
          <div className="trade-list">
            {waivers.map(w => (
              <div key={w.id} className="trade-item">
                <strong>{w.team_name}</strong> claimed <em>{w.movie_title}</em>
                <span className="date">{new Date(w.claimed_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
