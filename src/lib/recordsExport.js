// "A copy of our records": every record the marae keeps in MaraeHub, as one zip
// of spreadsheet-ready files. It is the trustees' own copy, kept outside
// MaraeHub, so an outage or a change of provider never leaves them without
// their records (ISO 22301 continuity, ISO 9001 records).
//
// Read-only and built in the browser from what the signed-in trustee is
// already allowed to read, so it adds no new access to anyone's data.

import { createZip } from './zipStore';

const PAGE = 1000;

// What goes in the copy. Deliberately left out: user accounts and login history,
// connection tokens (Xero, Google), founder-only tables, feedback and system logs.
export const EXPORT_TABLES = [
  { table: 'marae_settings', label: 'Marae details' },
  { table: 'entities', label: 'Entities' },
  { table: 'meetings', label: 'Hui and minutes' },
  { table: 'meeting_actions', label: 'Hui actions' },
  { table: 'resolutions', label: 'Resolutions' },
  { table: 'interest_register', label: 'Interests register' },
  { table: 'tasks', label: 'Tasks' },
  { table: 'task_comments', label: 'Task comments' },
  { table: 'workflow_instances', label: 'Workflows in progress' },
  { table: 'compliance_items', label: 'Compliance items' },
  { table: 'compliance_completions', label: 'Compliance completion history' },
  { table: 'incidents', label: 'Incidents' },
  { table: 'risk_register', label: 'Risk register' },
  { table: 'assets', label: 'Assets' },
  { table: 'service_reminders', label: 'Service reminders' },
  { table: 'documents', label: 'Documents list (names and where they are stored)' },
  { table: 'contacts', label: 'Contacts' },
  { table: 'contractors', label: 'Contractors' },
  { table: 'bookings', label: 'Bookings' },
  { table: 'booking_checklists', label: 'Booking checklists' },
  { table: 'booking_feedback', label: 'Booking feedback' },
  { table: 'blocked_dates', label: 'Blocked dates' },
  { table: 'notices', label: 'Notices' },
  { table: 'projects', label: 'Projects' },
  { table: 'goals', label: 'Goals' },
  { table: 'goal_links', label: 'Goal links' },
  { table: 'grants', label: 'Grants' },
  { table: 'module_kpi_snapshots', label: 'Monthly KPI snapshots' },
  { table: 'emergency_building_plans', label: 'Emergency building plans' },
  { table: 'emergency_map_points', label: 'Emergency map points' },
  { table: 'emergency_plan_hazards', label: 'Emergency plan hazards' },
  { table: 'emergency_plan_people', label: 'Emergency plan people' },
  { table: 'emergency_plan_pins', label: 'Emergency plan pins' },
  { table: 'emergency_response_events', label: 'Emergency response events' },
  { table: 'emergency_welfare_checks', label: 'Welfare checks' },
  { table: 'finance_income', label: 'Finance: income' },
  { table: 'finance_expenses', label: 'Finance: expenses' },
  { table: 'finance_budgets', label: 'Finance: budgets' },
  { table: 'finance_balance_sheet', label: 'Finance: balance sheet' },
  { table: 'finance_opening_balances', label: 'Finance: opening balances' },
  { table: 'gl_accounts', label: 'Ledger: accounts' },
  { table: 'gl_category_account_map', label: 'Ledger: category map' },
  { table: 'gl_journal_entries', label: 'Ledger: journal entries' },
  { table: 'gl_journal_lines', label: 'Ledger: journal lines' },
  { table: 'bank_reconciliations', label: 'Bank reconciliations' },
  { table: 'audit_log', label: 'Activity log (who did what)' },
];

// A cell that a spreadsheet could run as a formula gets a leading apostrophe.
// Plain numbers such as "-12.50" are left alone.
const FORMULA_START = /^[=+\-@\t\r]/;
const PLAIN_NUMBER = /^-?[\d.,]+$/;

export function csvCell(value) {
  if (value === null || value === undefined) return '';
  let s;
  if (value instanceof Date) s = value.toISOString();
  else if (typeof value === 'object') s = JSON.stringify(value);
  else s = String(value);
  if (typeof value === 'string' && FORMULA_START.test(s) && !PLAIN_NUMBER.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Rows -> CSV text. Columns are the keys in the order they first appear.
// The leading byte-order mark makes Excel show macrons (ā, ē, ī, ō, ū) correctly.
export function toCsv(rows) {
  const columns = [];
  const seen = new Set();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) { seen.add(key); columns.push(key); }
    }
  }
  const lines = [columns.map(csvCell).join(',')];
  for (const row of rows) lines.push(columns.map(c => csvCell(row[c])).join(','));
  return '﻿' + lines.join('\r\n') + '\r\n';
}

function isMissingOrDenied(error) {
  const text = `${error?.code || ''} ${error?.message || ''}`.toLowerCase();
  if (/42p01|pgrst205|does not exist|could not find the table/.test(text)) return 'not on this marae';
  if (/42501|permission denied|row-level security/.test(text)) return 'not available to your login';
  return null;
}

// Reads every row of one table, a page at a time.
export async function fetchAllRows(supabase, table) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table).select('*').order('id', { ascending: true }).range(from, from + PAGE - 1);
    if (error) return { rows: null, error };
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return { rows, error: null };
}

function slug(text) {
  return String(text || 'marae')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'marae';
}

function nzDate(date) {
  // en-CA gives YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland' }).format(date);
}

function nzDateTime(date) {
  return new Intl.DateTimeFormat('en-NZ', {
    timeZone: 'Pacific/Auckland', dateStyle: 'full', timeStyle: 'short',
  }).format(date);
}

export function buildReadme({ maraeName, exportedBy, now, results }) {
  const included = results.filter(r => r.status === 'ok');
  const skipped = results.filter(r => r.status !== 'ok');
  const lines = [
    `A COPY OF THE RECORDS OF ${String(maraeName || 'YOUR MARAE').toUpperCase()}`,
    'From MaraeHub',
    '',
    `Made: ${nzDateTime(now)} (New Zealand time)`,
    exportedBy ? `Made by: ${exportedBy}` : null,
    '',
    'This is a snapshot. It shows the records as they were when it was made, and it does not update.',
    'Each file in the "records" folder is a spreadsheet (CSV). Double-click to open in Excel, Numbers or Google Sheets.',
    '',
    'WHAT IS INCLUDED',
    ...included.map(r => `- ${r.file}: ${r.label} (${r.rows} ${r.rows === 1 ? 'row' : 'rows'})`),
    '',
  ];
  if (skipped.length) {
    lines.push('LEFT OUT');
    for (const r of skipped) lines.push(`- ${r.label}: ${r.reason}`);
    lines.push('');
  }
  lines.push(
    'NOT IN THIS COPY',
    '- The files that were uploaded (certificates, plans, minutes as PDFs and so on). The documents list shows their names and where they are kept. Ask MaraeHub for a copy of the files themselves.',
    '- User accounts, passwords and login history.',
    '- Connection details for other services such as Xero and Google.',
    '',
    'LOOKING AFTER THIS COPY',
    'It holds the same private information as the trustees\' papers, including names and contact details of hirers and whanau. Keep it somewhere only trustees can reach, and delete old copies you no longer need.',
    '',
    'Text that begins with = + - or @ has a leading apostrophe so a spreadsheet cannot run it as a formula.',
  );
  return lines.filter(l => l !== null).join('\r\n') + '\r\n';
}

/**
 * Builds the zip. `supabase` is the signed-in client.
 * Returns { bytes, filename, results } where results lists every table's outcome.
 */
export async function buildRecordsExport({ supabase, maraeName, exportedBy, now = new Date(), tables = EXPORT_TABLES, onProgress }) {
  const results = [];
  const files = [];

  for (let i = 0; i < tables.length; i++) {
    const { table, label } = tables[i];
    if (onProgress) onProgress({ done: i, total: tables.length, label });
    const { rows, error } = await fetchAllRows(supabase, table);
    if (error) {
      const reason = isMissingOrDenied(error);
      if (!reason) throw new Error(`Could not read ${label}: ${error.message || 'unknown error'}`);
      results.push({ table, label, status: 'skipped', reason });
      continue;
    }
    const file = `records/${table}.csv`;
    files.push({ name: file, data: toCsv(rows) });
    results.push({ table, label, status: 'ok', rows: rows.length, file });
  }
  if (onProgress) onProgress({ done: tables.length, total: tables.length, label: 'Packing' });

  files.unshift({ name: 'READ ME FIRST.txt', data: buildReadme({ maraeName, exportedBy, now, results }) });
  return {
    bytes: createZip(files, now),
    filename: `maraehub-records-${slug(maraeName)}-${nzDate(now)}.zip`,
    results,
  };
}

// Board View reminder for admin trustees: is the marae's own copy of its records recent?
// lastISO is when a copy was last downloaded (null if never). Returns null when no reminder is needed.
export const COPY_REMINDER_DAYS = 35;
export function copyReminderText(lastISO, now = new Date(), maxDays = COPY_REMINDER_DAYS) {
  if (!lastISO) {
    return 'Your marae does not have its own copy of its records yet. Download one in Settings so you always have your records, even if MaraeHub is unavailable.';
  }
  const days = Math.floor((now.getTime() - new Date(lastISO).getTime()) / 86400000);
  if (!(days > maxDays)) return null;
  const when = new Intl.DateTimeFormat('en-NZ', { timeZone: 'Pacific/Auckland', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(lastISO));
  return `Your last copy of the records was downloaded ${days} days ago (${when}). Download a fresh one in Settings, ideally before the next hui.`;
}
