// What's New announcements. To announce something: add an entry at the TOP of
// ANNOUNCEMENTS with a new unique id, a start date and an end date (inclusive,
// dates are the viewer's local day). It shows once per person until they close it,
// and stops showing by itself after the end date. Every marae gets the same list,
// because they all run the same code.

export const ANNOUNCEMENTS = [
  {
    id: '2026-11-emergency-plan-upgrades',
    badge: 'NEW',
    title: 'New in your Emergency Plan',
    subtitle: 'Three things to help your marae be ready.',
    startsOn: '2026-11-11',
    endsOn: '2026-11-13', // 3 days
    items: [
      {
        icon: '🏛️',
        title: 'Building Plan',
        where: 'Emergency Plan → Building Plan',
        text: 'No floor plan? Draw a simple plan of your marae in minutes, starting from a typical layout, and drag the boxes to match yours. Then drop pins for first aid, fire gear, shut-offs, the generator and where the keys are. Print it for the wall.',
      },
      {
        icon: '📋',
        title: 'What must a marae have?',
        where: 'Emergency Plan → Building Plan → bottom of the page',
        text: 'A checklist built from your pins, with what the law says in plain words and where it comes from. It is a general guide, not legal advice, and a pin does not prove something is working. Please check each item regularly.',
      },
      {
        icon: '🤝',
        title: 'Welfare Check',
        where: 'Emergency Plan → Welfare Check',
        text: 'A private list, only trustees can see it, of whānau who may need checking on in an emergency, like kaumātua living alone. It needs their agreement, and it holds no medical details.',
      },
    ],
  },
];

// Local calendar day as YYYY-MM-DD.
export function localDay(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// The announcement to show now, or null. Newest first; one at a time.
export function activeAnnouncement(list, today, seenId) {
  return list.find(a => a.startsOn <= today && today <= a.endsOn && a.id !== seenId) || null;
}
