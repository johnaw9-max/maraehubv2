export const INCOME_CATEGORIES  = ['Booking Income','Grant Income','Koha','Hire Equipment','Fundraiser','Other'];
export const EXPENSE_CATEGORIES = ['Maintenance and Repairs','Utilities','Insurance','Events','Administration','Wages','Equipment','Cleaning','Other'];

// Accountant-standard capital-vs-operating grouping, category-level only —
// not a per-transaction judgement (e.g. a $50 tool and a $5,000 mower both
// under "Equipment" are both Capital). Any category missing from this map
// falls back to "Uncategorised" rather than being silently guessed as
// Operating, so a future new category can't be miscounted by accident.
export const EXPENSE_CATEGORY_GROUPS = {
  'Maintenance and Repairs': 'Operating',
  'Utilities':               'Operating',
  'Insurance':               'Operating',
  'Events':                  'Operating',
  'Administration':          'Operating',
  'Wages':                   'Operating',
  'Equipment':               'Capital',
  'Cleaning':                'Operating',
  'Other':                   'Operating',
};
export function expenseCategoryGroup(category) {
  return EXPENSE_CATEGORY_GROUPS[category] || 'Uncategorised';
}

// Income has no genuine capital/operating split: that distinction depends
// on a transaction's purpose (e.g. a capital grant vs an operating grant),
// not its category, and the app has no data to tell those apart per row.
// Every income category is honestly grouped as Revenue rather than forcing
// a fake distinction the data can't support.
export const INCOME_CATEGORY_GROUP = 'Revenue';
