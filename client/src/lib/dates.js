/**
 * Due dates are calendar dates ("due Oct 25"), not instants. The server
 * stores them at UTC midnight (new Date('YYYY-MM-DD')), so every display
 * and comparison must treat them in UTC - otherwise users west of UTC see
 * "Oct 24" and tasks turn overdue a day early.
 */

/** "Oct 25" - always in UTC, regardless of the browser's timezone. */
export function formatDueDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
  });
}

/** A task is overdue once the UTC calendar day of its due date has ended. */
export function isOverdue(task) {
  if (!task.dueDate || task.status === 'DONE') return false;
  const d = new Date(task.dueDate);
  const endOfDayUtc = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999)
  );
  return endOfDayUtc < new Date();
}

/** Value for <input type="date"> derived from the stored UTC date. */
export function dueDateInputValue(iso) {
  return iso ? String(iso).slice(0, 10) : '';
}

/**
 * Payload for the API from the date input: the plain YYYY-MM-DD string,
 * which the server stores as UTC midnight. Converting through
 * new Date(...).toISOString() here would be a no-op shift, and building a
 * local Date would store local midnight - rendered as the previous day in
 * UTC-based UIs.
 */
export function dueDateToPayload(value) {
  return value ? value : null;
}
