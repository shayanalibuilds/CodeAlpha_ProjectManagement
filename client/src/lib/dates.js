/**
 * Due dates are calendar dates: the API stores them as UTC midnight of the
 * chosen day (e.g. "2026-10-25T00:00:00.000Z"). Always read them back in
 * UTC so the day never shifts for users west (or east) of UTC.
 */

/** "2026-10-25T00:00:00.000Z" -> "2026-10-25" (value for <input type="date">). */
export function toDateInputValue(dueDate) {
  if (!dueDate) return '';
  const d = new Date(dueDate);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

/** Short label for a due date, e.g. "Oct 25", in the user's locale. */
export function formatDueDate(dueDate, locale) {
  if (!dueDate) return '';
  return new Date(dueDate).toLocaleDateString(locale, {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
  });
}

/** Local end of the due day (23:59:59.999 on that calendar date, local time). */
export function dueDateCutoff(dueDate) {
  const d = new Date(dueDate);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999);
}

/** True once the due day has fully passed in the user's timezone. */
export function isOverdue(task, now = new Date()) {
  if (!task?.dueDate || task.status === 'DONE') return false;
  return dueDateCutoff(task.dueDate) < now;
}
