// Repeat meetings: "add this meeting every week / fortnight / month". Creates the dates now, one meeting each.
// Capped on purpose (MAX_REPEATS in total, including the first). A trustee can run it again when the dates run out.
// Pure functions, no network.

export const MAX_REPEATS = 12;

export const REPEAT_OPTIONS = [
  { value: 'none', label: 'Does not repeat' },
  { value: 'weekly', label: 'Every week' },
  { value: 'fortnightly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Every month (same day of the month)' },
];

function parse(ds) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ds || ''));
  if (!m) return null;
  return { y: +m[1], mo: +m[2] - 1, d: +m[3] };
}
function fmt(date) {
  return date.toISOString().slice(0, 10);
}

// The date of the nth meeting (n = 0 is the first), counted from the first date, never from the one before.
// Monthly keeps the same day of the month, or the last day when the month is shorter (31 Jan -> 28 Feb).
export function nthDate(startDate, freq, n) {
  const p = parse(startDate);
  if (!p) return null;
  if (freq === 'weekly' || freq === 'fortnightly') {
    const step = freq === 'weekly' ? 7 : 14;
    return fmt(new Date(Date.UTC(p.y, p.mo, p.d + step * n)));
  }
  if (freq === 'monthly') {
    const total = p.mo + n;
    const y = p.y + Math.floor(total / 12);
    const mo = ((total % 12) + 12) % 12;
    const lastDay = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
    return fmt(new Date(Date.UTC(y, mo, Math.min(p.d, lastDay))));
  }
  return n === 0 ? fmt(new Date(Date.UTC(p.y, p.mo, p.d))) : null;
}

// How many meetings will actually be made: at least 1, never more than MAX_REPEATS.
export function clampCount(count) {
  const n = Math.floor(Number(count));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, MAX_REPEATS);
}

// All the dates, including the first. "none" gives just the first date.
export function buildRepeatDates(startDate, freq, count) {
  if (!parse(startDate)) return [];
  if (!freq || freq === 'none') return [nthDate(startDate, 'none', 0)];
  const total = clampCount(count);
  const dates = [];
  for (let i = 0; i < total; i++) dates.push(nthDate(startDate, freq, i));
  return dates;
}
