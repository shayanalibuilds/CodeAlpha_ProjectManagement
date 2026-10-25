// Regression tests for issue #9: due dates must not shift a day for users
// west (or east) of UTC. Each case runs under several timezones; Node picks
// up changes to process.env.TZ at runtime.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { toDateInputValue, formatDueDate, isOverdue, dueDateCutoff } from '../src/lib/dates.js';

const ZONES = ['America/Los_Angeles', 'America/New_York', 'Pacific/Honolulu', 'UTC', 'Asia/Karachi', 'Pacific/Kiritimati'];
const stored = '2026-10-25T00:00:00.000Z'; // what the API stores for "Oct 25"
const originalTZ = process.env.TZ;
after(() => {
  process.env.TZ = originalTZ;
});

for (const tz of ZONES) {
  test(`[${tz}] the card shows the chosen calendar day`, () => {
    process.env.TZ = tz;
    assert.equal(formatDueDate(stored, 'en-US'), 'Oct 25');
  });

  test(`[${tz}] the date input shows the chosen day`, () => {
    process.env.TZ = tz;
    assert.equal(toDateInputValue(stored), '2026-10-25');
    assert.equal(toDateInputValue(null), '');
  });

  test(`[${tz}] the overdue cut-off is the end of the due day in local time`, () => {
    process.env.TZ = tz;
    const cutoff = dueDateCutoff(stored);
    assert.deepEqual(
      [cutoff.getFullYear(), cutoff.getMonth(), cutoff.getDate(), cutoff.getHours()],
      [2026, 9, 25, 23]
    );
  });

  test(`[${tz}] a task is overdue only after its due day ends`, () => {
    process.env.TZ = tz;
    const task = { dueDate: stored, status: 'TODO' };
    assert.equal(isOverdue(task, new Date(2026, 9, 25, 0, 0)), false);
    assert.equal(isOverdue(task, new Date(2026, 9, 25, 23, 59)), false);
    assert.equal(isOverdue(task, new Date(2026, 9, 26, 0, 0, 1)), true);
    assert.equal(isOverdue({ ...task, status: 'DONE' }, new Date(2027, 0, 1)), false);
  });
}

test('the old implementation would have failed west of UTC (sanity check)', () => {
  process.env.TZ = 'America/New_York';
  const old = new Date(stored).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  assert.equal(old, 'Oct 24');
});
