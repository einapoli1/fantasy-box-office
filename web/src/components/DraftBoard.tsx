interface Props {
  picks: any[];
  teams: string[];
  currentPick?: number;
}

export default function DraftBoard({ picks, teams, currentPick }: Props) {
  if (!picks.length) return <p className="empty">Draft hasn't started</p>;

  const maxRound = Math.max(...picks.map(p => p.round));
  const rounds = Array.from({ length: maxRound }, (_, i) => i + 1);

  return (
    <div className="draft-board">
      <table>
        <thead>
          <tr>
            <th>Round</th>
            {teams.map(t => <th key={t}>{t}</th>)}
          </tr>
        </thead>
        <tbody>
          {rounds.map(round => (
            <tr key={round}>
              <td className="round-num">{round}</td>
              {teams.map(teamName => {
                const pick = picks.find(p => p.round === round && p.team_name === teamName);
                const isCurrent = pick?.pick_number === currentPick && !pick?.movie_id;
                return (
                  <td key={teamName} className={`draft-cell ${isCurrent ? 'current' : ''} ${pick?.movie_id ? 'picked' : ''}`}>
                    {pick?.movie_title || (isCurrent ? '⏳' : '—')}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
