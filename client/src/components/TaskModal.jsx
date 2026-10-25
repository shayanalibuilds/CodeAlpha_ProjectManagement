import { useEffect, useId, useRef, useState } from 'react';
import {
  Trash2,
  Loader2,
  Send,
  MessageSquare,
  CalendarDays,
  User,
  Flag,
  ListTodo,
  AlignLeft,
  AlertCircle,
} from 'lucide-react';
import clsx from 'clsx';
import api, { getErrorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import Modal from './ui/Modal';
import Avatar from './ui/Avatar';
import { STATUSES, PRIORITIES } from '../lib/constants';
import { toDateInputValue } from '../lib/dates';

function Field({ icon: Icon, label, htmlFor, children }) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5"
      >
        <Icon size={12} aria-hidden="true" /> {label}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400 transition';

export default function TaskModal({ task, members, onClose, onChanged, onDeleted }) {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(true);
  const [posting, setPosting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');
  const [commentsError, setCommentsError] = useState('');
  const commentsEndRef = useRef(null);
  const taskId = task._id;
  const ids = useId();
  const fieldId = (name) => `${ids}-${name}`;

  // Keep the editable fields in sync when a teammate changes the task.
  useEffect(() => setTitle(task.title), [task.title]);
  useEffect(() => setDescription(task.description || ''), [task.description]);

  useEffect(() => {
    let cancelled = false;
    setLoadingComments(true);
    api
      .get(`/tasks/${taskId}/comments`)
      .then((res) => !cancelled && setComments(res.data.comments))
      .catch((err) => !cancelled && setCommentsError(getErrorMessage(err)))
      .finally(() => !cancelled && setLoadingComments(false));
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments.length]);

  // Real-time comments from teammates
  useEffect(() => {
    if (!socket) return;
    const onComment = (payload) => {
      if (payload.taskId !== taskId) return;
      setComments((prev) => {
        if (prev.some((c) => c._id === payload.comment._id)) return prev;
        return [...prev, payload.comment];
      });
    };
    socket.on('comment:added', onComment);
    return () => socket.off('comment:added', onComment);
  }, [socket, taskId]);

  const patch = async (updates) => {
    setSaving(true);
    setError('');
    try {
      const res = await api.patch(`/tasks/${taskId}`, updates);
      onChanged(res.data.task);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const saveTitle = () => {
    const t = title.trim();
    if (t && t !== task.title) patch({ title: t });
    else setTitle(task.title);
  };

  const saveDescription = () => {
    if ((description || '') !== (task.description || '')) patch({ description });
  };

  const addComment = async (e) => {
    e.preventDefault();
    const content = newComment.trim();
    if (!content) return;
    setPosting(true);
    setError('');
    try {
      const res = await api.post(`/tasks/${taskId}/comments`, { content });
      setComments((prev) => {
        if (prev.some((c) => c._id === res.data.comment._id)) return prev;
        return [...prev, res.data.comment];
      });
      setNewComment('');
      // The server returns the authoritative total; the comment:added socket
      // event carries the same number, so applying both is idempotent.
      if (typeof res.data.commentCount === 'number') {
        onChanged({ ...task, commentCount: res.data.commentCount });
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setPosting(false);
    }
  };

  const doDelete = async () => {
    try {
      await api.delete(`/tasks/${taskId}`);
      onDeleted(taskId);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
      setConfirmDelete(false);
    }
  };

  const dueDateValue = toDateInputValue(task.dueDate);
  const titleId = fieldId('title');

  return (
    <Modal open onClose={onClose} width="max-w-2xl" labelledBy={titleId}>
      <div className="p-5 sm:p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <input
              id={titleId}
              data-autofocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
              className="w-full text-lg font-semibold text-slate-800 bg-transparent outline-none rounded-lg px-1 -mx-1 hover:bg-slate-50 focus:bg-slate-50 focus:ring-2 focus:ring-brand-300 transition"
              aria-label="Task title"
            />
            <p className="text-xs text-slate-400 mt-1 px-1">
              Created by{' '}
              <span className="font-medium text-slate-500">{task.creator?.name || 'unknown'}</span>
              {task.createdAt &&
                ` · ${new Date(task.createdAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}`}
              {saving && (
                <span className="inline-flex items-center gap-1 ml-2 text-brand-600">
                  <Loader2 size={10} className="animate-spin" /> saving…
                </span>
              )}
            </p>
          </div>
          {confirmDelete ? (
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={doDelete}
                className="text-xs font-semibold text-white bg-rose-500 hover:bg-rose-600 rounded-lg px-2.5 py-1.5"
              >
                Delete task
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs text-slate-500 hover:text-slate-700 px-1"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-2 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors shrink-0"
              aria-label="Delete task"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>

        {error && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-xl bg-rose-50 text-rose-700 text-sm px-3 py-2"
          >
            <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span className="flex-1">{error}</span>
            <button
              type="button"
              onClick={() => setError('')}
              className="text-xs font-semibold underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Fields grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          <Field icon={ListTodo} label="Status" htmlFor={fieldId('status')}>
            <select
              id={fieldId('status')}
              value={task.status}
              onChange={(e) => patch({ status: e.target.value })}
              className={inputCls}
            >
              {STATUSES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          <Field icon={Flag} label="Priority" htmlFor={fieldId('priority')}>
            <select
              id={fieldId('priority')}
              value={task.priority}
              onChange={(e) => patch({ priority: e.target.value })}
              className={inputCls}
            >
              {Object.entries(PRIORITIES).map(([key, p]) => (
                <option key={key} value={key}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
          <Field icon={User} label="Assignee" htmlFor={fieldId('assignee')}>
            <select
              id={fieldId('assignee')}
              value={task.assignee?._id || ''}
              onChange={(e) => patch({ assignee: e.target.value || null })}
              className={inputCls}
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m._id} value={m._id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
          <Field icon={CalendarDays} label="Due date" htmlFor={fieldId('due')}>
            <input
              id={fieldId('due')}
              type="date"
              value={dueDateValue}
              // Send the calendar date as-is (YYYY-MM-DD); the API stores it as UTC midnight.
              onChange={(e) => patch({ dueDate: e.target.value || null })}
              className={inputCls}
            />
          </Field>
        </div>

        {/* Description */}
        <div className="mt-5">
          <Field icon={AlignLeft} label="Description" htmlFor={fieldId('description')}>
            <textarea
              id={fieldId('description')}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={saveDescription}
              placeholder="Add more details about this task…"
              className={clsx(inputCls, 'resize-none')}
            />
          </Field>
        </div>

        {/* Comments */}
        <div className="mt-6">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
            <MessageSquare size={12} /> Comments ({comments.length})
          </h3>

          <div className="max-h-64 overflow-y-auto thin-scroll space-y-3 pr-1">
            {loadingComments && (
              <p className="text-sm text-slate-400 flex items-center gap-2">
                <Loader2 size={13} className="animate-spin" /> Loading comments…
              </p>
            )}
            {commentsError && (
              <p role="alert" className="text-sm text-rose-600">
                Could not load comments: {commentsError}
              </p>
            )}
            {!loadingComments && !commentsError && comments.length === 0 && (
              <p className="text-sm text-slate-400 py-2">
                No comments yet — start the discussion below.
              </p>
            )}
            {comments.map((c) => {
              const mine = c.author?._id === user?.id;
              return (
                <div key={c._id} className="flex gap-2.5">
                  <Avatar name={c.author?.name} size="sm" className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div
                      className={clsx(
                        'rounded-xl px-3 py-2 text-sm',
                        mine ? 'bg-brand-50 text-brand-900' : 'bg-slate-50 text-slate-700'
                      )}
                    >
                      <p className="font-semibold text-xs text-slate-600 mb-0.5">
                        {c.author?.name} {mine && <span className="text-slate-400">(you)</span>}
                        <span className="font-normal text-slate-400 ml-2">
                          {new Date(c.createdAt).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </p>
                      <p className="whitespace-pre-wrap break-words leading-snug">{c.content}</p>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={commentsEndRef} />
          </div>

          <form onSubmit={addComment} className="flex gap-2 mt-4">
            <input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write a comment…"
              aria-label="Write a comment"
              maxLength={1000}
              className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400 transition"
            />
            <button
              type="submit"
              disabled={posting || !newComment.trim()}
              className="px-3.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white transition-colors disabled:opacity-50"
              aria-label="Send comment"
            >
              {posting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </form>
        </div>
      </div>
    </Modal>
  );
}
