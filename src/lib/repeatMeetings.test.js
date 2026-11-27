import { MAX_REPEATS, clampCount, nthDate, buildRepeatDates } from './repeatMeetings';

describe('repeat meetings', () => {
  it('caps the number of meetings made at once', () => {
    expect(MAX_REPEATS).toBe(12);
    expect(clampCount(500)).toBe(12);
    expect(clampCount(0)).toBe(1);
    expect(clampCount('abc')).toBe(1);
    expect(clampCount(4.9)).toBe(4);
  });
  it('weekly and fortnightly steps', () => {
    expect(buildRepeatDates('2026-12-01', 'weekly', 3)).toEqual(['2026-12-01', '2026-12-08', '2026-12-15']);
    expect(buildRepeatDates('2026-12-01', 'fortnightly', 3)).toEqual(['2026-12-01', '2026-12-15', '2026-12-29']);
  });
  it('crosses the year end', () => {
    expect(buildRepeatDates('2026-12-22', 'fortnightly', 3)).toEqual(['2026-12-22', '2027-01-05', '2027-01-19']);
  });
  it('monthly keeps the day, or the last day of a short month, counted from the first date', () => {
    expect(buildRepeatDates('2026-01-31', 'monthly', 4)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
    expect(nthDate('2026-11-15', 'monthly', 2)).toBe('2027-01-15');
  });
  it('never more than the cap, whatever number is asked for', () => {
    expect(buildRepeatDates('2026-12-01', 'weekly', 999)).toHaveLength(12);
  });
  it('no repeat gives only the first date; a bad date gives nothing', () => {
    expect(buildRepeatDates('2026-12-01', 'none', 5)).toEqual(['2026-12-01']);
    expect(buildRepeatDates('', 'weekly', 5)).toEqual([]);
  });
});

describe('calendar event rows', () => {
  const { addDays, daysBetween, buildEventRows } = require('./repeatMeetings');
  it('moves and measures dates', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(daysBetween('2026-12-01', '2026-12-03')).toBe(2);
  });
  it('one event with a note and an end date', () => {
    expect(buildEventRows({ title: ' Working bee ', note: '', date: '2026-12-05', endDate: '2026-12-06', repeat: 'none', count: 9 }))
      .toEqual([{ title: 'Working bee', note: null, event_date: '2026-12-05', end_date: '2026-12-06' }]);
  });
  it('repeats keep the same length and stop at the cap', () => {
    const rows = buildEventRows({ title: 'Kapa haka', date: '2026-12-01', endDate: '2026-12-02', repeat: 'weekly', count: 100 });
    expect(rows).toHaveLength(12);
    expect(rows[1]).toMatchObject({ event_date: '2026-12-08', end_date: '2026-12-09' });
  });
});
