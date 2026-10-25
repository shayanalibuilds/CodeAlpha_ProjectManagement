import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import {
  KanbanSquare,
  Users,
  MessageSquare,
  Zap,
  Loader2,
  LogIn,
  UserPlus,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AuthPage() {
  const { user, loading, login, register, demoLogin } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to="/" replace />;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    const result =
      mode === 'login'
        ? await login(form.email, form.password)
        : await register(form.name, form.email, form.password);
    setBusy(false);
    if (result.ok) navigate('/', { replace: true });
    else setError(result.error);
  };

  const demo = async () => {
    setError('');
    setBusy(true);
    const result = await demoLogin();
    setBusy(false);
    if (result.ok) navigate('/', { replace: true });
    else setError(result.error);
  };

  return (
    <div className="min-h-screen flex bg-slate-100">
      {/* Left: pitch panel */}
      <div className="hidden lg:flex flex-col justify-between flex-1 bg-gradient-to-br from-brand-700 via-brand-600 to-teal-700 text-white p-12 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/10" />
        <div className="absolute bottom-10 -left-20 w-72 h-72 rounded-full bg-white/5" />
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
              <KanbanSquare size={24} />
            </div>
            <span className="text-2xl font-bold tracking-tight">TaskFlow</span>
          </div>
          <h1 className="mt-14 text-4xl font-bold leading-tight max-w-md">
            Plan projects together, in real time.
          </h1>
          <p className="mt-4 text-brand-100 max-w-md leading-relaxed">
            A collaborative project management tool with Kanban boards, task assignments,
            comments and instant WebSocket updates — built with the MERN stack.
          </p>
          <ul className="mt-10 space-y-4 text-sm">
            {[
              { icon: Users, text: 'Create group projects and invite your team' },
              { icon: KanbanSquare, text: 'Drag & drop task cards across To-Do, In-Progress, Done' },
              { icon: MessageSquare, text: 'Discuss every task with comments' },
              { icon: Zap, text: 'Live board updates and notifications via Socket.io' },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-brand-50">
                <span className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                  <Icon size={16} />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-brand-200">
          CodeAlpha Full Stack Development — Task 3: Project Management Tool
        </p>
      </div>

      {/* Right: form */}
      <div className="w-full lg:max-w-md flex flex-col justify-center px-6 py-12 sm:px-12 bg-white">
        <div className="lg:hidden flex items-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center">
            <KanbanSquare size={22} />
          </div>
          <span className="text-xl font-bold text-slate-800">TaskFlow</span>
        </div>

        <h2 className="text-2xl font-bold text-slate-800">
          {mode === 'login' ? 'Welcome back' : 'Create your account'}
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          {mode === 'login'
            ? 'Sign in to open your project boards.'
            : 'Join TaskFlow and start collaborating in seconds.'}
        </p>

        <form onSubmit={submit} className="mt-8 space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5" htmlFor="name">
                Full name
              </label>
              <input
                id="name"
                type="text"
                required
                minLength={2}
                value={form.name}
                onChange={set('name')}
                placeholder="Shayan Ali"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400 transition"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={form.email}
              onChange={set('email')}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400 transition"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={set('password')}
              placeholder="••••••••"
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400 transition"
            />
          </div>

          {error && (
            <p className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2.5 text-sm transition-colors disabled:opacity-60"
          >
            {busy ? (
              <Loader2 size={16} className="animate-spin" />
            ) : mode === 'login' ? (
              <LogIn size={16} />
            ) : (
              <UserPlus size={16} />
            )}
            {mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div className="flex items-center gap-3 my-6">
          <div className="h-px bg-slate-200 flex-1" />
          <span className="text-xs text-slate-400">or</span>
          <div className="h-px bg-slate-200 flex-1" />
        </div>

        <button
          onClick={demo}
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-brand-200 bg-brand-50 hover:bg-brand-100 text-brand-700 font-semibold py-2.5 text-sm transition-colors disabled:opacity-60"
        >
          <Sparkles size={16} />
          Explore with the demo account
        </button>
        <p className="text-xs text-slate-400 mt-2 text-center">
          demo@taskflow.dev · demo1234 — preloaded with sample projects
        </p>

        <p className="text-sm text-slate-500 mt-8 text-center">
          {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError('');
            }}
            className="font-semibold text-brand-600 hover:text-brand-700"
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}
