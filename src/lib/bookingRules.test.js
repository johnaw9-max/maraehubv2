import {
  isOwnBooking, isFinished, memberCanEdit, editNeedsReapproval,
  memberCancelMode, validateBookingEdit, rangesOverlap,
} from './bookingRules';
import { BOOKING_OCCASIONS, OCCASION_DETAILS, occasionsFor } from './bookingOccasions';
import { endDateAfterStartChange } from './bookingDates';

const TODAY = '2026-11-07';
const mine = (o = {}) => ({ id: 'b1', user_id: 'u1', status: 'pending', start_date: '2026-12-01', end_date: '2026-12-02', ...o });

describe('member booking rules', () => {
  test('only the owner counts as owner', () => {
    expect(isOwnBooking(mine(), 'u1')).toBe(true);
    expect(isOwnBooking(mine(), 'u2')).toBe(false);
    expect(isOwnBooking(mine(), null)).toBe(false);
    expect(isOwnBooking(null, 'u1')).toBe(false);
  });

  test('pending and approved future bookings are editable by the owner', () => {
    expect(memberCanEdit(mine(), 'u1', TODAY)).toBe(true);
    expect(memberCanEdit(mine({ status: 'approved' }), 'u1', TODAY)).toBe(true);
  });

  test('declined, finished, or someone else\'s bookings are not editable', () => {
    expect(memberCanEdit(mine({ status: 'declined' }), 'u1', TODAY)).toBe(false);
    expect(memberCanEdit(mine({ start_date: '2026-10-01', end_date: '2026-10-02' }), 'u1', TODAY)).toBe(false);
    expect(memberCanEdit(mine(), 'u2', TODAY)).toBe(false);
  });

  test('a booking ending today is not finished', () => {
    expect(isFinished(mine({ end_date: TODAY }), TODAY)).toBe(false);
    expect(isFinished(mine({ end_date: '2026-11-06' }), TODAY)).toBe(true);
    expect(isFinished(mine({ end_date: null, start_date: '2026-11-06' }), TODAY)).toBe(true);
  });

  test('editing an approved booking needs re-approval, a pending one does not', () => {
    expect(editNeedsReapproval(mine({ status: 'approved' }))).toBe(true);
    expect(editNeedsReapproval(mine())).toBe(false);
  });

  test('cancel mode: pending deletes, approved sends a request, otherwise none', () => {
    expect(memberCancelMode(mine(), 'u1', TODAY)).toBe('delete');
    expect(memberCancelMode(mine({ status: 'approved' }), 'u1', TODAY)).toBe('request');
    expect(memberCancelMode(mine({ status: 'declined' }), 'u1', TODAY)).toBe(null);
    expect(memberCancelMode(mine({ end_date: '2026-10-01', start_date: '2026-10-01' }), 'u1', TODAY)).toBe(null);
    expect(memberCancelMode(mine(), 'u2', TODAY)).toBe(null);
  });
});

describe('edit validation', () => {
  const ok = { occasion: 'Hui', startDate: '2026-12-01', endDate: '2026-12-02', guests: 40, notes: '', organisation: '' };
  test('accepts a good form', () => expect(validateBookingEdit(ok)).toBe(''));
  test('requires occasion and dates', () => {
    expect(validateBookingEdit({ ...ok, occasion: '' })).toMatch(/occasion/i);
    expect(validateBookingEdit({ ...ok, startDate: '' })).toMatch(/dates/i);
  });
  test('end cannot be before start', () => expect(validateBookingEdit({ ...ok, endDate: '2026-11-30' })).toMatch(/before/i));
  test('guest count must be a number of at least 0', () => {
    expect(validateBookingEdit({ ...ok, guests: 'abc' })).toMatch(/guests/i);
    expect(validateBookingEdit({ ...ok, guests: -1 })).toMatch(/guests/i);
    expect(validateBookingEdit({ ...ok, guests: 0 })).toBe('');
  });
  test('length limits', () => {
    expect(validateBookingEdit({ ...ok, notes: 'x'.repeat(501) })).toMatch(/500/);
    expect(validateBookingEdit({ ...ok, organisation: 'x'.repeat(121) })).toMatch(/120/);
  });
});

describe('date overlap', () => {
  test('overlaps include shared edge days', () => {
    expect(rangesOverlap('2026-12-01', '2026-12-03', '2026-12-03', '2026-12-05')).toBe(true);
    expect(rangesOverlap('2026-12-01', '2026-12-02', '2026-12-03', '2026-12-05')).toBe(false);
    expect(rangesOverlap('2026-12-04', null, '2026-12-03', '2026-12-05')).toBe(true);
    expect(rangesOverlap(null, null, '2026-12-03', '2026-12-05')).toBe(false);
  });
});

describe('end date follows the start date (Jason, 5 Nov)', () => {
  test('empty end date takes the start date', () => expect(endDateAfterStartChange('2027-01-20', '')).toBe('2027-01-20'));
  test('end date before the new start moves to the start', () => expect(endDateAfterStartChange('2027-01-20', '2026-11-07')).toBe('2027-01-20'));
  test('a later end date is left alone', () => expect(endDateAfterStartChange('2027-01-20', '2027-01-25')).toBe('2027-01-25'));
  test('clearing the start leaves the end as it was', () => {
    expect(endDateAfterStartChange('', '2027-01-25')).toBe('2027-01-25');
    expect(endDateAfterStartChange('', undefined)).toBe('');
  });
});

describe('occasions (Jason, 5 Nov)', () => {
  test('new occasions are present and the old reunion name is replaced', () => {
    expect(BOOKING_OCCASIONS).toEqual(expect.arrayContaining(['Hura Kōhatu', 'Whānau Gathering', 'Noho Marae/Noho Wānanga']));
    expect(BOOKING_OCCASIONS).not.toContain('Whanau Reunion');
    expect(BOOKING_OCCASIONS[BOOKING_OCCASIONS.length - 1]).toBe('Other');
  });
  test('every occasion has an icon and description for the wizard', () => {
    BOOKING_OCCASIONS.forEach(o => {
      expect(OCCASION_DETAILS[o]).toBeDefined();
      expect(OCCASION_DETAILS[o].icon).toBeTruthy();
      expect(OCCASION_DETAILS[o].sub).toBeTruthy();
    });
  });
  test('an older value stays selectable when editing an old booking', () => {
    expect(occasionsFor('Whanau Reunion')).toContain('Whanau Reunion');
    expect(occasionsFor('Whanau Reunion').slice(-1)[0]).toBe('Other');
    expect(occasionsFor('Hui')).toEqual(BOOKING_OCCASIONS);
  });
});
