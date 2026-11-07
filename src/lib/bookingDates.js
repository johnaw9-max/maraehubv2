/**
 * End date to use after the start date changes.
 *
 * Jason Kurei (Ōpeke, 5 Nov 2026): when a start date months ahead is chosen,
 * the end-date calendar opened on today and he had to scroll forward again.
 * Rule: if the end date is empty, or now falls before the start date, set it to
 * the start date, so the calendar opens there. Otherwise leave the person's
 * end date alone. Dates are YYYY-MM-DD strings, which compare correctly as text.
 */
export function endDateAfterStartChange(newStart, currentEnd) {
  if (!newStart) return currentEnd || '';
  if (!currentEnd || currentEnd < newStart) return newStart;
  return currentEnd;
}
