import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { ToastProvider } from './components/Toast';
import Notifications from './components/Notifications';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import LeagueView from './pages/LeagueView';
import DraftRoom from './pages/DraftRoom';
import TeamView from './pages/TeamView';
import MovieDetail from './pages/MovieDetail';
import TradeCenter from './pages/TradeCenter';
import WaiverWire from './pages/WaiverWire';
import Profile from './pages/Profile';
import SeasonHistory from './pages/SeasonHistory';
import JoinLeague from './pages/JoinLeague';
import Movies from './pages/Movies';
import './App.css';

function Nav() {
  const { user, logout } = useAuth();
  return (
    <nav className="navbar">
      <Link to="/" className="nav-brand">🎬 Fantasy Box Office</Link>
      <div className="nav-links">
        {user ? (
          <>
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/movies">Movies</Link>
            <Link to="/history">History</Link>
            <Notifications />
            <Link to="/profile">{user.display_name}</Link>
            <button className="nav-btn" onClick={logout}>Logout</button>
          </>
        ) : (
          <Link to="/login" className="btn btn-primary btn-sm">Sign In</Link>
        )}
      </div>
    </nav>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Nav />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/league/:id" element={<ProtectedRoute><LeagueView /></ProtectedRoute>} />
              <Route path="/league/:id/draft" element={<ProtectedRoute><DraftRoom /></ProtectedRoute>} />
              <Route path="/league/:id/trades" element={<ProtectedRoute><TradeCenter /></ProtectedRoute>} />
              <Route path="/league/:id/waivers" element={<ProtectedRoute><WaiverWire /></ProtectedRoute>} />
              <Route path="/team/:id" element={<ProtectedRoute><TeamView /></ProtectedRoute>} />
              <Route path="/movie/:id" element={<MovieDetail />} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/movies" element={<Movies />} />
              <Route path="/history" element={<SeasonHistory />} />
              <Route path="/join/:code" element={<JoinLeague />} />
            </Routes>
          </main>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
