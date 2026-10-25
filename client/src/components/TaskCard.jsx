import clsx from 'clsx';
import {
  CalendarDays,
  MessageSquare,
  GripVertical,
} from 'lucide-react';
import { PRIORITIES, avatarColor, initials } from '../lib/constants';
import { formatDueDate, isOverdue } from '../lib/dates';

export default function TaskCard({ task, onOpen, onDragStart, onDragEnd, dragging }) {
  const priority = PRIORITIES[task.priority] || PRIORITIES.MEDIUM;
  const overdue = isOverdue(task);
  const statusMeta = { TODO: 'To-Do', IN_PROGRESS: 'In-Progress', DONE: 'Done' };
  const accessibleName = [
    task.title,
    statusMeta[task.status] || task.status,
    `priority ${priority.label}`,
    task.dueDate ? `due ${formatDueDate(task.dueDate)}` : null,
  ]
    .filter(Boolean)
    .join(', ');

  const activate = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen(task);
    }
  };

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task._id)}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(task)}
      onKeyDown={activate}
      role="button"
      tabIndex={0}
      aria-label={`Open task: ${accessibleName}`}
      className={clsx(
        'group bg-white rounded-xl border border-slate-200 shadow-card hover:shadow-pop hover:border-brand-200 cursor-pointer transition-all p-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:border-brand-300',
        dragging && 'card-dragging'
      )}
    >
      <div className="flex items-start gap-2">
        <GripVertical
          size={14}
          className="text-slate-300 mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        />
        <div className="min-w-0 flex-1">
          <p
            className={clsx(
              'text-sm font-medium leading-snug break-words',
              task.status === 'DONE' ? 'text-slate-400 line-through' : 'text-slate-700'
            )}
          >
            {task.title}
          </p>
          <div className="flex items-center flex-wrap gap-1.5 mt-2">
            <span
              className={clsx(
                'text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md ring-1',
                priority.cls
              )}
            >
              {priority.label}
            </span>
            {task.dueDate && (
              <span
                className={clsx(
                  'flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md',
                  overdue
                    ? 'bg-rose-50 text-rose-600'
                    : 'bg-slate-100 text-slate-500'
                )}
              >
                <CalendarDays size={10} />
                {formatDueDate(task.dueDate)}
              </span>
            )}
            {(task.commentCount || 0) > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 px-1 py-0.5">
                <MessageSquare size={10} />
                {task.commentCount}
              </span>
            )}
          </div>
        </div>
        {task.assignee ? (
          <div
            className={clsx(
              'w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0',
              avatarColor(task.assignee.name)
            )}
            title={`Assigned to ${task.assignee.name}`}
          >
            {initials(task.assignee.name)}
          </div>
        ) : (
          <div
            className="w-6 h-6 rounded-full border border-dashed border-slate-300 shrink-0"
            title="Unassigned"
          />
        )}
      </div>
    </div>
  );
}
