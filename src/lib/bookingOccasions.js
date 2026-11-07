// Occasions offered when making a booking. Occasion names are stored as plain
// text on the booking, so existing bookings (e.g. "Whanau Reunion") keep
// displaying exactly as saved. Nothing in the app depends on the exact names.
//
// Requested by Jason Kurei (Ōpeke), 5 Nov 2026:
//   • Hura Kōhatu (new)
//   • Whānau Gathering replaces Whanau Reunion (reunion, whānau hui, whānau kaupapa all go here)
//   • Noho Marae / Noho Wānanga (new)
export const BOOKING_OCCASIONS = [
  'Tangi',
  'Wedding/Hakari',
  'Birthday',
  'Hui',
  'Fundraiser',
  'Hura Kōhatu',
  'Whānau Gathering',
  'Noho Marae/Noho Wānanga',
  'Other',
];

// Icons and one-line descriptions for the community booking wizard.
export const OCCASION_DETAILS = {
  'Tangi':                   { icon: '🕊️', sub: 'Tangihanga / Funeral' },
  'Wedding/Hakari':          { icon: '💍', sub: 'Celebration feast' },
  'Birthday':                { icon: '🎂', sub: 'Milestone celebration' },
  'Hui':                     { icon: '🤝', sub: 'Community meeting' },
  'Fundraiser':              { icon: '🏆', sub: 'Charity / kaupapa event' },
  'Hura Kōhatu':             { icon: '🪨', sub: 'Unveiling' },
  'Whānau Gathering':        { icon: '👨‍👩‍👧‍👦', sub: 'Reunion, whānau hui, whānau kaupapa' },
  'Noho Marae/Noho Wānanga': { icon: '🏛️', sub: 'Stay-over / learning retreat' },
  'Other':                   { icon: '✨', sub: 'Something else' },
};

/**
 * Occasion values for an edit form: the standard list, plus the booking's
 * current value if it is an older one (e.g. "Whanau Reunion") so editing an
 * old booking never silently changes its occasion.
 */
export function occasionsFor(current) {
  return current && !BOOKING_OCCASIONS.includes(current)
    ? [...BOOKING_OCCASIONS.slice(0, -1), current, 'Other']
    : BOOKING_OCCASIONS;
}
