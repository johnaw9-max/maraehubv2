import { ANNOUNCEMENTS, activeAnnouncement, localDay } from './whatsNewItems';

const a = { id: 'x', startsOn: '2026-11-11', endsOn: '2026-11-13', items: [] };

test('shows on each of its 3 days, not before or after', () => {
  expect(activeAnnouncement([a], '2026-11-10', null)).toBeNull();
  ['2026-11-11', '2026-11-12', '2026-11-13'].forEach(d => expect(activeAnnouncement([a], d, null)).toBe(a));
  expect(activeAnnouncement([a], '2026-11-14', null)).toBeNull();
});

test('does not show again once closed, and a newer announcement still shows', () => {
  expect(activeAnnouncement([a], '2026-11-12', 'x')).toBeNull();
  const b = { id: 'y', startsOn: '2026-11-12', endsOn: '2026-11-14', items: [] };
  expect(activeAnnouncement([b, a], '2026-11-12', 'x')).toBe(b);
});

test('the real announcement list is well formed', () => {
  const ids = new Set();
  ANNOUNCEMENTS.forEach(an => {
    expect(ids.has(an.id)).toBe(false);
    ids.add(an.id);
    expect(an.startsOn <= an.endsOn).toBe(true);
    expect(an.items.length).toBeGreaterThan(0);
    an.items.forEach(i => { expect(i.title && i.text && i.where).toBeTruthy(); });
  });
});

test('localDay formats as YYYY-MM-DD', () => {
  expect(localDay(new Date(2026, 10, 5))).toBe('2026-11-05');
});
