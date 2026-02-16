import { useAuth } from '../lib/auth';
import { useNavigate } from 'react-router-dom';

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  return (
    <div className="profile">
      <h1>Profile</h1>
      <div className="profile-card">
        <div className="profile-avatar">{user.display_name?.[0]?.toUpperCase() || '?'}</div>
        <div className="profile-info">
          <h2>{user.display_name}</h2>
          <p>{user.email}</p>
          <p className="joined">Member since {new Date(user.created_at).toLocaleDateString()}</p>
        </div>
      </div>
      <button className="btn btn-secondary" onClick={() => { logout(); navigate('/'); }}>Sign Out</button>
    </div>
  );
}
