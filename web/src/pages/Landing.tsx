import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export default function Landing() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="landing">
      <section className="hero">
        <h1>🎬 Fantasy Box Office</h1>
        <p className="tagline">Fantasy football, but for movies.</p>
        <p className="subtitle">
          Draft upcoming blockbusters. Compete with friends. Win based on real box office performance.
        </p>
        <div className="hero-actions">
          {user ? (
            <button className="btn btn-primary btn-lg" onClick={() => navigate('/dashboard')}>
              Go to Dashboard
            </button>
          ) : (
            <>
              <button className="btn btn-primary btn-lg" onClick={() => navigate('/login')}>Get Started</button>
              <button className="btn btn-secondary btn-lg" onClick={() => navigate('/login')}>Sign In</button>
            </>
          )}
        </div>
      </section>

      <section className="how-it-works">
        <h2>How It Works</h2>
        <div className="steps">
          <div className="step">
            <span className="step-num">1</span>
            <h3>Create a League</h3>
            <p>Invite 4-12 friends and set your draft date</p>
          </div>
          <div className="step">
            <span className="step-num">2</span>
            <h3>Draft Movies</h3>
            <p>Snake draft upcoming releases for the year</p>
          </div>
          <div className="step">
            <span className="step-num">3</span>
            <h3>Earn Points</h3>
            <p>Score based on box office, ratings, and milestones</p>
          </div>
          <div className="step">
            <span className="step-num">4</span>
            <h3>Win Glory</h3>
            <p>Trade, pick up free agents, and dominate the standings</p>
          </div>
        </div>
      </section>

      <section className="scoring-preview">
        <h2>Scoring</h2>
        <div className="scoring-grid">
          <div className="score-item"><span className="pts">1 pt</span> per $1M opening weekend</div>
          <div className="score-item"><span className="pts">0.5 pts</span> per $1M domestic gross</div>
          <div className="score-item"><span className="pts">0.25 pts</span> per $1M worldwide gross</div>
          <div className="score-item"><span className="pts">+10</span> Rotten Tomatoes 75%+</div>
          <div className="score-item"><span className="pts">+15</span> #1 opening weekend</div>
          <div className="score-item"><span className="pts">+20</span> $100M+ domestic</div>
          <div className="score-item"><span className="pts">+50</span> $500M+ worldwide</div>
          <div className="score-item"><span className="pts">-10</span> Flop (budget &gt; 2x gross)</div>
        </div>
      </section>
    </div>
  );
}
