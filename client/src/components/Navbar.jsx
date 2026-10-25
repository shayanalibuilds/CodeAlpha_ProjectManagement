import { useEffect, useRef, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  KanbanSquare,
  Bell,
  LogOut,
  ChevronDown,
  Check,
  ClipboardList,
  UserPlus,
  MessageSquare,
  ArrowRightCircle,
} from 'lucide-react';
import clsx from 'clsx';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import Avatar from './ui/Avatar';

const TYPE_ICONS = {
  TASK_ASSIGNED: { icon: UserPlus, cls: 'bg-brand-50 text-brand-600' },
  TASK_STATUS: { icon: ArrowRightCircle, cls: 'bg-amber-50 text-amber-600' },
  COMMENT_ADDED: { icon: MessageSquare, cls: 'bg-violet-50 text-violet-600' },
  MEMBER_JOINED: { icon: ClipboardList, cls: 'bg-sky-50 text-sky-600' },
};

function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);
  const { socket } = useSocket();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/notifications');
      setItems(res.data.notifications);
      setUnread(res.data.unreadCount);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Real-time pushes
  useEffect(() => {
    if (!socket) return;
    const onNew = (n) => {
      setItems((prev) => [n, ...prev].slice(0, 30));
      setUnread((u) => u + 1);
    };
    socket.on('notification:new', onNew);
    return () => socket.off('notification:new', onNew);
  }, [socket]);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const markAllRead = async () => {
    try {
      await api.post('/notifications/read-all');
      setUnread(0);
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          setOpen((o) => !o);
          if (!open) load();
        }}
        className="relative p-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        aria-label="Notifications"
      >
        <Bell size={19} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-pop border border-slate-100 overflow-hidden animate-popIn z-40">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700">Notifications</h3>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs font-medium text-brand-600 hover:text-brand-700 flex items-center gap-1"
              >
                <Check size={12} /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto thin-scroll divide-y divide-slate-50">
            {loading && items.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8">Loading…</p>
            )}
            {!loading && items.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8">You're all caught up.</p>
            )}
            {items.map((n) => {
              const meta = TYPE_ICONS[n.type] || TYPE_ICONS.TASK_STATUS;
              const Icon = meta.icon;
              return (
                <div
                  key={n.id}
                  className={clsx(
                    'flex gap-3 px-4 py-3 text-sm',
                    !n.read && 'bg-brand-50/40'
                  )}
                >
                  <span
                    className={clsx(
                      'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
                      meta.cls
                    )}
                  >
                    <Icon size={15} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-slate-700 leading-snug">{n.message}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {n.project?.name && <span className="font-medium">{n.project.name} · </span>}
                      {timeAgo(n.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Navbar({ presenceCount = null }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2 font-bold text-slate-800">
          <span className="w-8 h-8 rounded-lg bg-brand-600 text-white flex items-center justify-center">
            <KanbanSquare size={18} />
          </span>
          <span className="text-lg tracking-tight">TaskFlow</span>
        </Link>

        <div className="flex-1" />

        {presenceCount !== null && (
          <span className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 mr-1">
            <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
            {presenceCount} online
          </span>
        )}

        <NotificationsBell />

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 rounded-xl pl-1 pr-2 py-1 hover:bg-slate-100 transition-colors"
            aria-label="Account menu"
          >
            <Avatar name={user?.name} size="sm" />
            <span className="hidden sm:block text-sm font-medium text-slate-700 max-w-[120px] truncate">
              {user?.name}
            </span>
            <ChevronDown size={14} className="text-slate-400" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-pop border border-slate-100 p-2 animate-popIn z-40">
              <div className="px-3 py-2 border-b border-slate-100 mb-1">
                <p className="text-sm font-semibold text-slate-700 truncate">{user?.name}</p>
                <p className="text-xs text-slate-400 truncate">{user?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-rose-600 hover:bg-rose-50 transition-colors"
              >
                <LogOut size={15} /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
