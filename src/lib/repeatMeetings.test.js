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
