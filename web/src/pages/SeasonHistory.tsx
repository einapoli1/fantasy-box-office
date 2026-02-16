import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import type { SeasonWinner, SeasonRecord } from '../lib/api';
import Skeleton from '../components/Skeleton';

export default function SeasonHistory() {
  const [winners, setWinners] = useState<SeasonWinner[]>([]);
  const [records, setRecords] = useState<SeasonRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getSeasonHistory()
      .then(data => { setWinners(data.winners); setRecords(data.records); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="season-history"><Skeleton lines={6} /></div>;
  if (error) return (
    <div className="season-history">
      <div className="error-state">
        <p>Failed to load history: {error}</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>Retry</button>
      </div>
    </div>
  );

  return (
    <div className="season-history">
      <h1>🏆 Season History</h1>

      <section>
        <h2>Champions</h2>
        {winners.length === 0 ? (
          <p className="empty">No completed seasons yet</p>
        ) : (
          <div className="champions-list">
            {winners.map(w => (
              <div key={w.season_year} className="champion-card">
                <span className="trophy">🏆</span>
                <div>
                  <h3>{w.season_year} Champion</h3>
                  <strong>{w.team_name}</strong>
                  <span>by {w.owner}</span>
                  <span className="pts">{w.total_points.toFixed(1)} pts</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {records.length > 0 && (
        <section>
          <h2>Records</h2>
          <div className="records-grid">
            {records.map(r => (
              <div key={r.type} className="record-card">
                <h4>{r.label}</h4>
                <span className="record-value">{r.value}</span>
                <span className="record-holder">{r.holder}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
