// Real vs. closed resolution statuses, per the Decision Register's own
// documented definitions (HelpMenu.js): Implemented and Superseded both mean
// the decision is no longer current, same as Completed/Cancelled for a plain
// resolution -- only Active (or the base Open/In Progress lifecycle) is open.
export const CLOSED_RESOLUTION_STATUSES = ['Completed', 'Cancelled', 'Implemented', 'Superseded'];

export function isResolutionOpen(status) {
  return !CLOSED_RESOLUTION_STATUSES.includes(status);
}
