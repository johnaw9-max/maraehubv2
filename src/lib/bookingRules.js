// What a community member may do with their own booking.
//
// Rule (agreed by John, 7 Nov 2026: "community should be able to edit their
// bookings"), designed so the trustees stay in control of approvals:
//   • Pending booking  -> the member can edit it and cancel (delete) it.
//   • Approved booking, event still in the future -> the member can edit it,
//     but it goes back to "pending" so the trustees approve the change again.
//     To cancel, the member sends the trustees a cancellation request
//     (they decline or delete it); a member cannot delete an approved booking.
//   • Declined, or the event is over -> read only.
// The database enforces the same rule (migration m_booking_member_rules), so
// it holds even if someone calls the API directly.

const todayStr = () => new Date().toISOString().slice(0, 10);

export function isOwnBooking(booking, userId) {
  return !!booking && !!userId && booking.user_id === userId;
}

export function isFinished(booking, today = todayStr()) {
  const last = booking?.end_date || booking?.start_date;
  return !!last && last < today;
}

/** Can this member edit the booking? */
export function memberCanEdit(booking, userId, today = todayStr()) {
  if (!isOwnBooking(booking, userId)) return false;
  if (booking.status !== 'pending' && booking.status !== 'approved') return false;
  return !isFinished(booking, today);
}

/** Editing an approved booking sends it back for approval. */
export function editNeedsReapproval(booking) {
  return booking?.status === 'approved';
}

/** 'delete' (pending), 'request' (approved, still to come) or null. */
export function memberCancelMode(booking, userId, today = todayStr()) {
  if (!isOwnBooking(booking, userId)) return null;
  if (isFinished(booking, today)) return null;
  if (booking.status === 'pending') return 'delete';
  if (booking.status === 'approved') return 'request';
  return null;
}

/** Validation for the edit form. Returns an error message, or '' when fine. */
export function validateBookingEdit(form) {
  if (!form.occasion) return 'Please choose an occasion.';
  if (!form.startDate || !form.endDate) return 'Start and end dates are required.';
  if (form.endDate < form.startDate) return 'The end date cannot be before the start date.';
  const guests = parseInt(form.guests, 10);
  if (!Number.isFinite(guests) || guests < 0) return 'Please enter a valid number of guests.';
  if (form.notes && form.notes.length > 500) return 'Notes must be 500 characters or fewer.';
  if (form.organisation && form.organisation.length > 120) return 'Organisation must be 120 characters or fewer.';
  return '';
}

/** Do two date ranges (YYYY-MM-DD, inclusive) overlap? */
export function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  const ae = aEnd || aStart;
  const be = bEnd || bStart;
  return !!aStart && !!bStart && aStart <= be && ae >= bStart;
}
