import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, Notification } from '../lib/api';

export default function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const loadNotifications = async () => {
    try { setNotifications(await api.getNotifications()); } catch {}
  };

  const unread = notifications.filter(n => !n.read).length;

  const handleClick = async (n: Notification) => {
    if (!n.read) {
      try { await api.markNotificationRead(n.id); } catch {}
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
    }
    if (n.link) navigate(n.link);
    setOpen(false);
  };

  const typeIcons: Record<string, string> = {
    draft_pick: '🎬', trade_proposed: '🔄', trade_accepted: '✅',
    trade_rejected: '❌', waiver_claimed: '📋', milestone: '🏆',
  };

  return (
    <div className="notifications-wrapper" ref={ref}>
      <button className="nav-btn notification-bell" onClick={() => setOpen(!open)}>
        🔔
        {unread > 0 && <span className="notification-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="notification-dropdown">
          <div className="notification-header">
            <h3>Notifications</h3>
          </div>
          {notifications.length === 0 ? (
            <p className="notification-empty">No notifications</p>
          ) : (
            <div className="notification-list">
              {notifications.slice(0, 20).map(n => (
                <div
                  key={n.id}
                  className={`notification-item ${n.read ? '' : 'unread'}`}
                  onClick={() => handleClick(n)}
                >
                  <span className="notification-icon">{typeIcons[n.type] || '📌'}</span>
                  <div className="notification-content">
                    <p>{n.message}</p>
                    <span className="notification-time">
                      {new Date(n.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
