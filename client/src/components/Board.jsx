import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Search,
  UserPlus,
  Trash2,
  Loader2,
  Users,
  Filter,
  KanbanSquare,
  Inbox,
  AlertCircle,
} from 'lucide-react';
import clsx from 'clsx';
import api, { getErrorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import Navbar from './Navbar';
import TaskCard from './TaskCard';
import TaskModal from './TaskModal';
import Modal from './ui/Modal';
import Avatar from './ui/Avatar';
import { EmptyState, Spinner } from './ui/Bits';
import { STATUSES, PRIORITIES, PROJECT_COLORS } from '../lib/constants';

/**
 * Merges an updated task into the existing one. Keeps the known comment count
 * when the update does not carry one, so moving or editing a card never
 * resets its comment badge.
 */
function mergeTask(prev, updated) {
  return {
    ...prev,
    ...updated,
    commentCount: typeof updated.commentCount === 'number' ? updated.commentCount : prev.commentCount,
  };
}

const inputCls =
  'rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400 transition bg-white';

function AddMemberModal({ project, open, onClose, onAdded }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api.post(`/projects/${project._id}/members`, { email });
      onAdded(res.data.member);
      setEmail('');
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add a teammate">
      <form onSubmit={submit} className="p-5 space-y-4">
        <p className="text-sm text-slate-500">
          Enter the <span className="font-semibold">TaskFlow account email</span> of the person you
          want to invite to <span className="font-medium text-slate-700">{project.name}</span>.
        </p>
        <input
          data-autofocus
          type="email"
          aria-label="Teammate email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="teammate@example.com"
          className={clsx(inputCls, 'w-full')}
        />
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold disabled:opacity-60"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            <UserPlus size={14} /> Add member
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Lists project members; owners can remove someone after confirming. */
function MembersModal({ open, onClose, members, ownerId, isOwner, currentUserId, onRemove, online }) {
  const [confirmingId, setConfirmingId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      setConfirmingId(null);
      setError('');
    }
  }, [open]);

  const remove = async (member) => {
    setBusyId(member._id);
    setError('');
    try {
      await onRemove(member._id);
      setConfirmingId(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Members (${members.length})`}>
      <div className="p-5 space-y-3">
        {error && (
          <p role="alert" className="text-sm text-rose-600">
            {error}
          </p>
        )}
        <ul className="divide-y divide-slate-100">
          {members.map((m) => {
            const isOnline = online.some((o) => o.id === m._id);
            const canRemove = isOwner && m._id !== currentUserId;
            return (
              <li key={m._id} className="flex items-center gap-3 py-2.5">
                <Avatar name={m.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-700 truncate">
                    {m.name}
                    {m._id === ownerId && <span className="ml-1.5 text-xs text-slate-400">(owner)</span>}
                    {m._id === currentUserId && <span className="ml-1.5 text-xs text-slate-400">(you)</span>}
                  </p>
                  <p className="text-xs text-slate-400 truncate">
                    {m.email}
                    {isOnline && <span className="ml-1.5 text-brand-600">· online</span>}
                  </p>
                </div>
                {canRemove &&
                  (confirmingId === m._id ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => remove(m)}
                        disabled={busyId === m._id}
                        className="flex items-center gap-1 text-xs font-semibold text-white bg-rose-500 hover:bg-rose-600 rounded-lg px-2.5 py-1.5 disabled:opacity-60"
                      >
                        {busyId === m._id && <Loader2 size={11} className="animate-spin" />}
                        Remove {m.name.split(' ')[0]}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingId(null)}
                        className="text-xs text-slate-500 hover:text-slate-700 px-1.5 py-1"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmingId(m._id)}
                      className="flex items-center gap-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg px-2.5 py-1.5 shrink-0"
                      aria-label={`Remove ${m.name} from the project`}
                    >
                      <Trash2 size={12} aria-hidden="true" /> Remove
                    </button>
                  ))}
              </li>
            );
          })}
        </ul>
        {isOwner && (
          <p className="text-xs text-slate-400">
            Removing a member also unassigns them from this project&apos;s tasks.
          </p>
        )}
      </div>
    </Modal>
  );
}

function Column({ status, tasks, onAddTask, children, dropActive, onDragOver, onDragLeave, onDrop }) {
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const composerRef = useRef(null);
  const meta = STATUSES.find((s) => s.key === status);

  useEffect(() => {
    if (composing) composerRef.current?.focus();
  }, [composing]);

  const submit = async (e) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    setBusy(true);
    try {
      await onAddTask(t, status);
      setTitle('');
      setComposing(false);
    } catch {
      // The board shows the error; keep the typed title so the user can retry.
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={clsx(
        'flex flex-col bg-slate-200/50 rounded-2xl w-[85vw] sm:w-80 shrink-0 transition-shadow',
        dropActive && 'column-drop-active'
      )}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      data-status={status}
    >
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <span className={clsx('w-2 h-2 rounded-full', meta.dot)} />
          <h3 className={clsx('text-sm font-bold', meta.header)}>{meta.label}</h3>
          <span className="text-xs font-semibold text-slate-400 bg-white rounded-full px-2 py-0.5">
            {tasks.length}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto thin-scroll px-3 pb-2 space-y-2 min-h-[120px]">
        {children}
        {tasks.length === 0 && !dropActive && (
          <div className="flex flex-col items-center justify-center py-8 text-slate-400">
            <Inbox size={22} className="mb-1.5 opacity-60" />
            <p className="text-xs">Drop tasks here</p>
          </div>
        )}
      </div>

      <div className="px-3 pb-3">
        {composing ? (
          <form onSubmit={submit} className="bg-white rounded-xl border border-brand-200 p-2 shadow-sm">
            <textarea
              ref={composerRef}
              aria-label={`New task title for ${meta.label}`}
              rows={2}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit(e);
                }
                if (e.key === 'Escape') setComposing(false);
              }}
              placeholder="Task title… (Enter to add)"
              className="w-full text-sm outline-none resize-none px-1"
            />
            <div className="flex justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setComposing(false)}
                className="text-xs font-medium text-slate-500 hover:text-slate-700 px-2 py-1"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || !title.trim()}
                className="flex items-center gap-1 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg px-2.5 py-1.5 disabled:opacity-50"
              >
                {busy && <Loader2 size={11} className="animate-spin" />}
                Add task
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setComposing(true)}
            className="w-full flex items-center gap-2 justify-center rounded-xl border-2 border-dashed border-slate-300 hover:border-brand-400 hover:text-brand-600 text-slate-400 text-sm font-medium py-2.5 transition-colors"
          >
            <Plus size={14} /> Add task
          </button>
        )}
      </div>
    </div>
  );
}

export default function Board() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const { socket } = useSocket();

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openTaskId, setOpenTaskId] = useState(null);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [online, setOnline] = useState([]);
  const [actionError, setActionError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  // DnD
  const [draggingId, setDraggingId] = useState(null);
  const [dropColumn, setDropColumn] = useState(null);
  const dragStopped = useRef(false);

  const loadBoard = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setLoading(true);
      try {
        const res = await api.get(`/projects/${projectId}`);
        setProject(res.data.project);
        setTasks(res.data.tasks);
        setError('');
      } catch (err) {
        if (!silent) setError(getErrorMessage(err));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [projectId]
  );

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  // --- Realtime wiring ---
  useEffect(() => {
    if (!socket || !projectId) return undefined;

    // Socket.io drops room membership on disconnect, so (re)join on every
    // connect. After a reconnect, refetch the board to catch missed events.
    let hasJoined = false;
    const join = () => {
      socket.emit('project:join', { projectId });
      if (hasJoined) loadBoard({ silent: true });
      hasJoined = true;
    };
    if (socket.connected) join();
    socket.on('connect', join);

    const onPresence = (p) => {
      if (p.projectId === projectId) setOnline(p.online || []);
    };

    const onTaskCreated = (payload) => {
      if (payload.projectId !== projectId) return;
      setTasks((prev) =>
        prev.some((t) => t._id === payload.task._id) ? prev : [...prev, payload.task]
      );
    };
    const onTaskUpdated = (payload) => {
      if (payload.projectId !== projectId) return;
      setTasks((prev) => prev.map((t) => (t._id === payload.task._id ? mergeTask(t, payload.task) : t)));
    };
    const onTaskDeleted = (payload) => {
      if (payload.projectId !== projectId) return;
      setTasks((prev) => prev.filter((t) => t._id !== payload.taskId));
      setOpenTaskId((id) => (id === payload.taskId ? null : id));
    };
    const onCommentAdded = (payload) => {
      if (payload.projectId !== projectId) return;
      setTasks((prev) =>
        prev.map((t) =>
          t._id === payload.taskId
            ? {
                ...t,
                // The server sends the authoritative total, so receiving the
                // author's own event (or applying it twice) never double counts.
                commentCount:
                  typeof payload.commentCount === 'number' ? payload.commentCount : (t.commentCount || 0) + 1,
              }
            : t
        )
      );
    };
    const onMemberJoined = (payload) => {
      if (payload.projectId !== projectId) return;
      setProject((p) =>
        p
          ? {
              ...p,
              members: [
                ...(p.members || []).some((m) => (m._id || m.id) === payload.member.id)
                  ? p.members
                  : [...(p.members || []), payload.member],
              ],
            }
          : p
      );
    };
    const onMemberLeft = (payload) => {
      if (payload.projectId !== projectId) return;
      if (payload.userId === user?.id) {
        setError('You were removed from this project.');
        return;
      }
      setProject((p) =>
        p
          ? {
              ...p,
              members: (p.members || []).filter((m) => (m._id || m.id) !== payload.userId),
            }
          : p
      );
      setTasks((prev) =>
        prev.map((t) =>
          t.assignee && (t.assignee._id || t.assignee) === payload.userId
            ? { ...t, assignee: null }
            : t
        )
      );
    };

    socket.on('presence:update', onPresence);
    socket.on('task:created', onTaskCreated);
    socket.on('task:updated', onTaskUpdated);
    socket.on('task:deleted', onTaskDeleted);
    socket.on('comment:added', onCommentAdded);
    socket.on('member:joined', onMemberJoined);
    socket.on('member:left', onMemberLeft);
    const onProjectDeleted = (payload) => {
      if (payload.projectId !== projectId) return;
      setOpenTaskId(null);
      setError('This project was deleted by its owner.');
    };
    const onJoinError = (payload) => {
      if (payload.projectId !== projectId) return;
      setError(payload.error || 'You do not have access to this project.');
    };
    socket.on('project:deleted', onProjectDeleted);
    socket.on('project:join:error', onJoinError);

    return () => {
      socket.emit('project:leave', { projectId });
      socket.off('connect', join);
      socket.off('project:deleted', onProjectDeleted);
      socket.off('project:join:error', onJoinError);
      socket.off('presence:update', onPresence);
      socket.off('task:created', onTaskCreated);
      socket.off('task:updated', onTaskUpdated);
      socket.off('task:deleted', onTaskDeleted);
      socket.off('comment:added', onCommentAdded);
      socket.off('member:joined', onMemberJoined);
      socket.off('member:left', onMemberLeft);
    };
  }, [socket, projectId, user?.id, loadBoard]);

  const members = useMemo(() => {
    const raw = project?.members || [];
    return raw.map((m) => ({ _id: m._id || m.id, name: m.name, email: m.email }));
  }, [project]);

  const isOwner = project && (project.owner?._id || project.owner) === user?.id;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (q && !t.title.toLowerCase().includes(q) && !t.description?.toLowerCase().includes(q)) {
        return false;
      }
      if (assigneeFilter) {
        if (assigneeFilter === 'unassigned' && t.assignee) return false;
        if (assigneeFilter !== 'unassigned' && t.assignee?._id !== assigneeFilter) return false;
      }
      if (priorityFilter && t.priority !== priorityFilter) return false;
      return true;
    });
  }, [tasks, search, assigneeFilter, priorityFilter]);

  const byStatus = useMemo(() => {
    const map = { TODO: [], IN_PROGRESS: [], DONE: [] };
    for (const t of filtered) {
      (map[t.status] || map.TODO).push(t);
    }
    for (const key of Object.keys(map)) map[key].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    return map;
  }, [filtered]);

  const filtersActive = search || assigneeFilter || priorityFilter;

  // --- DnD handlers ---
  const handleDragStart = (e, taskId) => {
    dragStopped.current = false;
    setDraggingId(taskId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDropColumn(null);
  };

  const handleDragOver = (e, status) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dropColumn !== status) setDropColumn(status);
  };

  const handleDrop = async (e, status) => {
    e.preventDefault();
    setDropColumn(null);
    const taskId = e.dataTransfer.getData('text/plain') || draggingId;
    setDraggingId(null);
    if (!taskId) return;
    const task = tasks.find((t) => t._id === taskId);
    if (!task || task.status === status) return;

    // Optimistic move
    setTasks((prev) => prev.map((t) => (t._id === taskId ? { ...t, status } : t)));
    try {
      const res = await api.patch(`/tasks/${taskId}`, { status });
      setTasks((prev) => prev.map((t) => (t._id === taskId ? mergeTask(t, res.data.task) : t)));
    } catch (err) {
      // Revert on failure
      setTasks((prev) => prev.map((t) => (t._id === taskId ? task : t)));
      setActionError(getErrorMessage(err));
    }
  };

  const addTask = async (title, status) => {
    try {
      const res = await api.post('/tasks', { projectId, title, status });
      const created = res.data.task;
      // Add it right away; the task:created echo is de-duplicated by _id.
      setTasks((prev) => (prev.some((t) => t._id === created._id) ? prev : [...prev, created]));
    } catch (err) {
      setActionError(getErrorMessage(err));
      throw err;
    }
  };

  // Throws on failure so the members dialog can show the error inline.
  const removeMember = async (userId) => {
    const res = await api.delete(`/projects/${projectId}/members/${userId}`);
    const unassigned = new Set(res.data.unassignedTaskIds || []);
    setProject((p) =>
      p ? { ...p, members: (p.members || []).filter((m) => (m._id || m.id) !== userId) } : p
    );
    setTasks((prev) =>
      prev.map((t) =>
        unassigned.has(t._id) || (t.assignee && (t.assignee._id || t.assignee) === userId)
          ? { ...t, assignee: null }
          : t
      )
    );
  };

  const openTask = tasks.find((t) => t._id === openTaskId) || null;

  const refreshProject = async () => {
    try {
      const res = await api.get(`/projects/${projectId}`);
      setProject(res.data.project);
    } catch {
      /* keep current state */
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Spinner className="w-8 h-8" />
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 bg-white">
          <EmptyState
            icon={KanbanSquare}
            title="Could not open this board"
            hint={error || 'The project may have been deleted or you may not have access.'}
          >
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold px-4 py-2.5 text-sm transition-colors"
            >
              <ArrowLeft size={15} /> Back to dashboard
            </Link>
          </EmptyState>
        </div>
      </div>
    );
  }

  const colors = PROJECT_COLORS[project.color] || PROJECT_COLORS.emerald;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar presenceCount={online.length} />

      {/* Board header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-full px-4 sm:px-6 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <Link
                to="/"
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-brand-600 transition-colors"
              >
                <ArrowLeft size={12} /> All projects
              </Link>
              <div className="flex items-center gap-2.5 mt-1">
                <span className={clsx('w-2.5 h-2.5 rounded-full', colors.bar)} />
                <h1 className="text-xl font-bold text-slate-800 truncate">{project.name}</h1>
              </div>
              {project.description && (
                <p className="text-sm text-slate-500 mt-0.5 max-w-2xl">{project.description}</p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMembersOpen(true)}
                className="flex items-center -space-x-2 mr-1 rounded-full focus-visible:ring-2 focus-visible:ring-brand-400 outline-none"
                aria-label={`View ${members.length} project member${members.length === 1 ? '' : 's'}${isOwner ? ' and manage the team' : ''}`}
                title={isOwner ? 'Manage members' : 'View members'}
              >
                {members.slice(0, 6).map((m) => {
                  const isOnline = online.some((o) => o.id === m._id);
                  return (
                    <span key={m._id} className="relative">
                      <Avatar name={m.name} size="sm" className="ring-2 ring-white" />
                      {isOnline && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-brand-500 ring-2 ring-white" />
                      )}
                    </span>
                  );
                })}
                {members.length > 6 && (
                  <span className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
                    +{members.length - 6}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setMembersOpen(true)}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 text-slate-600 font-semibold px-3 py-2 text-xs transition-colors"
              >
                <Users size={14} aria-hidden="true" /> Members
              </button>
              {isOwner && (
                <button
                  onClick={() => setAddMemberOpen(true)}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 text-slate-600 font-semibold px-3 py-2 text-xs transition-colors"
                >
                  <UserPlus size={14} /> Invite
                </button>
              )}
            </div>
          </div>

          {/* Filters row */}
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tasks…"
                aria-label="Search tasks"
                className={clsx(inputCls, 'pl-8 w-48 sm:w-60')}
              />
            </div>
            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className={inputCls}
              aria-label="Filter by assignee"
            >
              <option value="">All assignees</option>
              <option value="unassigned">Unassigned</option>
              {members.map((m) => (
                <option key={m._id} value={m._id}>
                  {m.name}
                </option>
              ))}
            </select>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className={inputCls}
              aria-label="Filter by priority"
            >
              <option value="">All priorities</option>
              {Object.entries(PRIORITIES).map(([key, p]) => (
                <option key={key} value={key}>
                  {p.label}
                </option>
              ))}
            </select>
            {filtersActive ? (
              <button
                onClick={() => {
                  setSearch('');
                  setAssigneeFilter('');
                  setPriorityFilter('');
                }}
                className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700 px-2 py-1.5"
              >
                <Filter size={12} /> Clear filters
              </button>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-slate-400 px-2 py-1.5">
                <Filter size={12} />
                {tasks.length} task{tasks.length === 1 ? '' : 's'} on this board
              </span>
            )}
          </div>
        </div>
      </div>

      {actionError && (
        <div
          role="alert"
          className="mx-4 sm:mx-6 mt-4 flex items-start gap-2 rounded-xl bg-rose-50 text-rose-700 text-sm px-3 py-2"
        >
          <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span className="flex-1">{actionError}</span>
          <button type="button" onClick={() => setActionError('')} className="text-xs font-semibold underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Columns */}
      <main className="flex-1 overflow-x-auto">
        <div className="flex gap-4 p-4 sm:p-6 h-full min-h-[calc(100vh-230px)]">
          {STATUSES.map((s) => (
            <Column
              key={s.key}
              status={s.key}
              tasks={byStatus[s.key]}
              onAddTask={addTask}
              dropActive={dropColumn === s.key}
              onDragOver={(e) => handleDragOver(e, s.key)}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) setDropColumn(null);
              }}
              onDrop={(e) => handleDrop(e, s.key)}
            >
              {byStatus[s.key].map((task) => (
                <TaskCard
                  key={task._id}
                  task={task}
                  dragging={draggingId === task._id}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onOpen={(t) => setOpenTaskId(t._id)}
                />
              ))}
            </Column>
          ))}
        </div>
      </main>

      {/* Task detail */}
      {openTask && (
        <TaskModal
          task={openTask}
          members={members}
          onClose={() => setOpenTaskId(null)}
          onChanged={(updated) =>
            setTasks((prev) => prev.map((t) => (t._id === updated._id ? mergeTask(t, updated) : t)))
          }
          onDeleted={(id) => setTasks((prev) => prev.filter((t) => t._id !== id))}
        />
      )}

      <MembersModal
        open={membersOpen}
        onClose={() => setMembersOpen(false)}
        members={members}
        ownerId={project.owner?._id || project.owner}
        isOwner={isOwner}
        currentUserId={user?.id}
        onRemove={removeMember}
        online={online}
      />

      <AddMemberModal
        project={project}
        open={addMemberOpen}
        onClose={() => setAddMemberOpen(false)}
        onAdded={refreshProject}
      />
    </div>
  );
}
