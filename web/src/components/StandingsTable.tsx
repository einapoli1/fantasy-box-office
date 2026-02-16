interface Props {
  standings: any[];
  onTeamClick?: (teamId: number) => void;
}

export default function StandingsTable({ standings, onTeamClick }: Props) {
  if (!standings.length) return <p className="empty">No standings yet</p>;
  return (
    <table className="standings-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Team</th>
          <th>Owner</th>
          <th>Roster</th>
          <th>Points</th>
        </tr>
      </thead>
      <tbody>
        {standings.map((s) => (
          <tr key={s.team_id} onClick={() => onTeamClick?.(s.team_id)} style={{ cursor: onTeamClick ? 'pointer' : 'default' }}>
            <td className="rank">{s.rank}</td>
            <td className="team-name">{s.team_name}</td>
            <td>{s.owner}</td>
            <td>{s.roster_size}</td>
            <td className="points">{s.total_points.toFixed(1)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
