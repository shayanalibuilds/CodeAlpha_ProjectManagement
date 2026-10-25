import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  KanbanSquare,
  FolderKanban,
  ListTodo,
  CircleCheckBig,
  Plus,
  Trash2,
  Users,
  Loader2,
  Compass,
} from 'lucide-react';
import clsx from 'clsx';
import api, { getErrorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import Navbar from './Navbar';
import Avatar from './ui/Avatar';
import Modal from './ui/Modal';
import { EmptyState, Spinner } from './ui/Bits';
import { PROJECT_COLORS } from '../lib/constants';

const COLOR_CHOICES = ['emerald', 'teal', 'amber', 'orange', 'rose', 'violet'];

function CreateProjectModal({ open, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('emerald');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api.post('/projects', { name, description, color });
      setName('');
      setDescription('');
      setColor('emerald');
      onCreated(res.data.project);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New project">
      <form onSubmit={submit} className="p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">Project name</label>
          <input
            autoFocus
            required
            minLength={2}
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Website Redesign"
            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400 transition"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">
            Description <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <textarea
            rows={3}
            maxLength={400}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this project about?"
            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400 transition resize-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-2">Color</label>
          <div className="flex gap-2">
            {COLOR_CHOICES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Color ${c}`}
                className={clsx(
                  'w-8 h-8 rounded-full transition-transform',
                  PROJECT_COLORS[c].bar,
                  color === c ? 'ring-2 ring-offset-2 scale-110 ring-slate-400' : 'hover:scale-105'
                )}
              />
            ))}
          </div>
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors disabled:opacity-60"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            Create project
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ProjectCard({ project, isOwner, onDeleted }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const colors = PROJECT_COLORS[project.color] || PROJECT_COLORS.emerald;
  const counts = project.taskCounts || { total: 0, todo: 0, inProgress: 0, done: 0 };
  const pct = counts.total ? Math.round((counts.done / counts.total) * 100) : 0;

  const doDelete = async () => {
    setDeleting(true);
    setError('');
    try {
      await api.delete(`/projects/${project._id}`);
      onDeleted(project._id);
    } catch (err) {
      setError(getErrorMessage(err));
      setDeleting(false);
    }
  };

  return (
    <div className="group bg-white rounded-2xl shadow-card border border-slate-100 hover:shadow-pop hover:-translate-y-0.5 transition-all overflow-hidden flex flex-col">
      <div className={clsx('h-1.5', colors.bar)} />
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2">
          <Link to={`/project/${project._id}`} className="min-w-0">
            <h3 className="font-semibold text-slate-800 truncate group-hover:text-brand-700 transition-colors">
              {project.name}
            </h3>
          </Link>
          {isOwner && (
            <div className="shrink-0">
              {confirming ? (
                <div className="flex items-center gap-1">
                  <button
                    onClick={doDelete}
                    disabled={deleting}
                    className="text-xs font-semibold text-white bg-rose-500 hover:bg-rose-600 rounded-lg px-2 py-1 disabled:opacity-60"
                  >
                    {deleting ? <Loader2 size={12} className="animate-spin" /> : 'Confirm'}
                  </button>
                  <button
                    onClick={() => setConfirming(false)}
                    className="text-xs text-slate-500 hover:text-slate-700 px-1"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirming(true)}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all"
                  aria-label={`Delete ${project.name}`}
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          )}
        </div>
        <p className="text-sm text-slate-500 mt-1 line-clamp-2 min-h-[2.5rem]">
          {project.description || 'No description yet.'}
        </p>
        {error && (
          <p role="alert" className="mt-2 text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-2 py-1.5">
            {error}
          </p>
        )}

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-slate-50 py-2">
            <p className="text-lg font-bold text-slate-700">{counts.todo}</p>
            <p className="text-[11px] text-slate-400 font-medium">To-Do</p>
          </div>
          <div className="rounded-xl bg-amber-50/60 py-2">
            <p className="text-lg font-bold text-amber-600">{counts.inProgress}</p>
            <p className="text-[11px] text-amber-500/80 font-medium">Active</p>
          </div>
          <div className="rounded-xl bg-brand-50 py-2">
            <p className="text-lg font-bold text-brand-600">{counts.done}</p>
            <p className="text-[11px] text-brand-500/80 font-medium">Done</p>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex justify-between text-xs text-slate-400 mb-1.5">
            <span>Progress</span>
            <span className="font-semibold text-slate-500">{pct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={clsx('h-full rounded-full transition-all', colors.bar)}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Users size={13} className="text-slate-400" />
            <div className="flex -space-x-1.5">
              {(project.members || []).slice(0, 4).map((m) => (
                <Avatar key={m._id || m.id} name={m.name} size="xs" className="ring-2 ring-white" />
              ))}
              {(project.members?.length || 0) > 4 && (
                <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
                  +{project.members.length - 4}
                </span>
              )}
            </div>
          </div>
          <Link
            to={`/project/${project._id}`}
            className={clsx(
              'text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors',
              colors.soft
            )}
          >
            Open board →
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/projects');
      setProjects(res.data.projects);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const totals = projects.reduce(
      (acc, p) => ({
        tasks: acc.tasks + (p.taskCounts?.total || 0),
        done: acc.done + (p.taskCounts?.done || 0),
      }),
      { tasks: 0, done: 0 }
    );
    return { projects: projects.length, ...totals };
  }, [projects]);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Hi {user?.name?.split(' ')[0]} 👋
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Here's what's happening across your projects.
            </p>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold px-4 py-2.5 text-sm shadow-sm transition-colors"
          >
            <Plus size={16} /> New project
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
          {[
            {
              icon: FolderKanban,
              label: 'Projects',
              value: stats.projects,
              cls: 'bg-brand-50 text-brand-600',
            },
            {
              icon: ListTodo,
              label: 'Total tasks',
              value: stats.tasks,
              cls: 'bg-amber-50 text-amber-600',
            },
            {
              icon: CircleCheckBig,
              label: 'Completed',
              value: stats.done,
              cls: 'bg-teal-50 text-teal-600',
            },
          ].map(({ icon: Icon, label, value, cls }) => (
            <div
              key={label}
              className="bg-white rounded-2xl shadow-card border border-slate-100 p-5 flex items-center gap-4"
            >
              <span className={clsx('w-11 h-11 rounded-xl flex items-center justify-center', cls)}>
                <Icon size={20} />
              </span>
              <div>
                <p className="text-2xl font-bold text-slate-800">{value}</p>
                <p className="text-xs text-slate-400 font-medium">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Projects */}
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mt-10 mb-4">
          Your projects
        </h2>
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner className="w-7 h-7" />
          </div>
        ) : error ? (
          <div className="bg-white rounded-2xl shadow-card border border-slate-100">
            <EmptyState
              icon={KanbanSquare}
              title="Could not load your projects"
              hint={error}
            >
              <button
                onClick={load}
                className="flex items-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold px-4 py-2.5 text-sm transition-colors"
              >
                <Loader2 size={16} /> Try again
              </button>
            </EmptyState>
          </div>
        ) : projects.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-card border border-slate-100">
            <EmptyState
              icon={Compass}
              title="No projects yet"
              hint="Create your first project, then invite teammates by email to start collaborating on the board."
            >
              <button
                onClick={() => setModalOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold px-4 py-2.5 text-sm transition-colors"
              >
                <Plus size={16} /> Create your first project
              </button>
            </EmptyState>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {projects.map((p) => (
              <ProjectCard
                key={p._id}
                project={p}
                isOwner={p.owner?._id === user?.id || p.owner === user?.id}
                onDeleted={(id) => setProjects((prev) => prev.filter((x) => x._id !== id))}
              />
            ))}
          </div>
        )}
      </main>
      <footer className="mt-auto py-5 text-center text-xs text-slate-400">
        TaskFlow — CodeAlpha Full Stack Development · Task 3: Project Management Tool
      </footer>

      <CreateProjectModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => load()}
      />
    </div>
  );
}
