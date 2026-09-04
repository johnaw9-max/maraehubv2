import { supabase } from './supabase';

// Stage 2 Step 2a of the General Ledger (ClickUp 14yhc7knyea) -- shared
// posting/voiding utility. Not yet wired into any of the real write paths
// (FinanceManager.js, BookingsManager.js, BookingInvoice.js,
// GrantsTracker.js, BankReconciliation.js) -- that's Step 2b, deliberately
// separate. Built and verified in isolation first.
//
// Accrual model: a Pending/unconfirmed row posts immediately to Accounts
// Receivable/Payable; when it later clears to Confirmed/Paid, a SEPARATE
// clearing entry moves it into Bank, leaving the original recognition
// entry untouched. A row that's Confirmed/Paid from its first save posts
// straight to Bank -- no round-trip through AR/AP for something that was
// never actually outstanding.

const BANK_ACCOUNT_CODE = 600;
const AR_ACCOUNT_CODE = 650;
const AP_ACCOUNT_CODE = 800;
const GST_ACCOUNT_CODE = 820;

// ─── PURE BUILDERS (no I/O) — the actual accounting logic ─────────────────

export function buildIncomeRecognitionLines({ amount, gstAmount, status, revenueAccountId, arAccountId, gstAccountId, bankAccountId }) {
  const full = parseFloat(amount);
  const gst = gstAmount != null ? parseFloat(gstAmount) : 0;
  const net = full - gst;
  const debitAccountId = status === 'Confirmed' ? bankAccountId : arAccountId;
  const lines = [
    { account_id: debitAccountId, debit: full, credit: 0 },
    { account_id: revenueAccountId, debit: 0, credit: net },
  ];
  if (gst > 0) lines.push({ account_id: gstAccountId, debit: 0, credit: gst });
  return lines;
}

export function buildExpenseRecognitionLines({ amount, gstAmount, status, expenseAccountId, apAccountId, gstAccountId, bankAccountId }) {
  const full = parseFloat(amount);
  const gst = gstAmount != null ? parseFloat(gstAmount) : 0;
  const net = full - gst;
  const creditAccountId = status === 'Paid' ? bankAccountId : apAccountId;
  const lines = [{ account_id: expenseAccountId, debit: net, credit: 0 }];
  if (gst > 0) lines.push({ account_id: gstAccountId, debit: gst, credit: 0 });
  lines.push({ account_id: creditAccountId, debit: 0, credit: full });
  return lines;
}

export function buildIncomeClearingLines({ amount, arAccountId, bankAccountId }) {
  const full = parseFloat(amount);
  return [
    { account_id: bankAccountId, debit: full, credit: 0 },
    { account_id: arAccountId, debit: 0, credit: full },
  ];
}

export function buildExpenseClearingLines({ amount, apAccountId, bankAccountId }) {
  const full = parseFloat(amount);
  return [
    { account_id: apAccountId, debit: full, credit: 0 },
    { account_id: bankAccountId, debit: 0, credit: full },
  ];
}

// Reversing entry: mirrors every line's debit/credit, so the original
// entry stays exactly as posted (immutability) while its effect is
// cancelled out -- the real Xero void pattern, not a deletion.
export function buildVoidLines(originalLines) {
  return originalLines.map(l => ({ account_id: l.account_id, debit: l.credit, credit: l.debit }));
}

export function linesBalance(lines) {
  const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
  return Math.abs(totalDebit - totalCredit) < 0.01;
}

// ─── I/O HELPERS ────────────────────────────────────────────────────────

export async function getAccountByCode(code) {
  const { data, error } = await supabase.from('gl_accounts').select('id, code, name, account_type').eq('code', code).single();
  if (error || !data) throw new Error(`GL account ${code} not found: ${error?.message || 'no row'}`);
  return data;
}

export async function getCategoryAccountId(category, module) {
  const { data, error } = await supabase.from('gl_category_account_map').select('account_id').eq('category', category).eq('module', module).single();
  if (error || !data) throw new Error(`No GL account mapped for ${module} category "${category}"`);
  return data.account_id;
}

// Always inserts the entry header, then ALL of its lines in one multi-row
// INSERT -- required by gl_journal_lines' statement-level balance trigger,
// not just a style choice. Refuses to even attempt an unbalanced post.
async function insertJournalEntry({ entryDate, description, sourceTable, sourceId, entryType, voidsEntryId, lines }) {
  if (!linesBalance(lines)) {
    throw new Error(`Refusing to post unbalanced journal entry: ${JSON.stringify(lines)}`);
  }
  const { data: entry, error: entryError } = await supabase
    .from('gl_journal_entries')
    .insert({
      entry_date: entryDate,
      description,
      source_table: sourceTable,
      source_id: sourceId,
      entry_type: entryType,
      voids_entry_id: voidsEntryId || null,
      created_by: 'system',
    })
    .select('id')
    .single();
  if (entryError) throw new Error(`Failed to create journal entry: ${entryError.message}`);

  const { error: linesError } = await supabase
    .from('gl_journal_lines')
    .insert(lines.map(l => ({ journal_entry_id: entry.id, account_id: l.account_id, debit: l.debit, credit: l.credit })));
  if (linesError) throw new Error(`Failed to post journal lines: ${linesError.message}`);

  return entry.id;
}

// ─── PUBLIC POSTING FUNCTIONS ───────────────────────────────────────────

export async function postIncomeEntry(row) {
  const [revenueAccountId, arAccount, bankAccount, gstAccount] = await Promise.all([
    getCategoryAccountId(row.category, 'income'),
    getAccountByCode(AR_ACCOUNT_CODE),
    getAccountByCode(BANK_ACCOUNT_CODE),
    getAccountByCode(GST_ACCOUNT_CODE),
  ]);
  const lines = buildIncomeRecognitionLines({
    amount: row.amount, gstAmount: row.gst_amount, status: row.status,
    revenueAccountId, arAccountId: arAccount.id, gstAccountId: gstAccount.id, bankAccountId: bankAccount.id,
  });
  return insertJournalEntry({
    entryDate: row.date,
    description: `Income recognition — ${row.category} — ${row.description || ''}`.trim(),
    sourceTable: 'finance_income', sourceId: row.id, entryType: 'recognition', lines,
  });
}

export async function postExpenseEntry(row) {
  const [expenseAccountId, apAccount, bankAccount, gstAccount] = await Promise.all([
    getCategoryAccountId(row.category, 'expense'),
    getAccountByCode(AP_ACCOUNT_CODE),
    getAccountByCode(BANK_ACCOUNT_CODE),
    getAccountByCode(GST_ACCOUNT_CODE),
  ]);
  const lines = buildExpenseRecognitionLines({
    amount: row.amount, gstAmount: row.gst_amount, status: row.status,
    expenseAccountId, apAccountId: apAccount.id, gstAccountId: gstAccount.id, bankAccountId: bankAccount.id,
  });
  return insertJournalEntry({
    entryDate: row.date,
    description: `Expense recognition — ${row.category} — ${row.description || ''}`.trim(),
    sourceTable: 'finance_expenses', sourceId: row.id, entryType: 'recognition', lines,
  });
}

// Called when a row transitions Pending -> Confirmed/Paid after already
// having a recognition entry posted at Pending. Does NOT touch that
// original entry -- posts a second, separate entry moving the balance
// from Accounts Receivable/Payable into Bank.
export async function postClearingEntry(row, module) {
  const [arOrApAccount, bankAccount] = await Promise.all([
    getAccountByCode(module === 'income' ? AR_ACCOUNT_CODE : AP_ACCOUNT_CODE),
    getAccountByCode(BANK_ACCOUNT_CODE),
  ]);
  const lines = module === 'income'
    ? buildIncomeClearingLines({ amount: row.amount, arAccountId: arOrApAccount.id, bankAccountId: bankAccount.id })
    : buildExpenseClearingLines({ amount: row.amount, apAccountId: arOrApAccount.id, bankAccountId: bankAccount.id });
  return insertJournalEntry({
    entryDate: new Date().toISOString().split('T')[0],
    description: `Payment ${module === 'income' ? 'received' : 'made'} — clearing entry`,
    sourceTable: module === 'income' ? 'finance_income' : 'finance_expenses',
    sourceId: row.id, entryType: 'clearing', lines,
  });
}

export async function getJournalEntriesForRow(sourceTable, sourceId) {
  const { data, error } = await supabase
    .from('gl_journal_entries')
    .select('*, gl_journal_lines(*)')
    .eq('source_table', sourceTable)
    .eq('source_id', sourceId)
    .order('created_at');
  if (error) throw new Error(error.message);
  return data || [];
}

// Reversing entry, not a deletion -- the original entry and its lines are
// never touched. Used for corrections/deletions of already-posted
// (Confirmed/Paid) rows, per the immutability model modelled on Xero's
// void-not-delete pattern.
export async function voidJournalEntry(entryId, reason) {
  const { data: entry, error: entryError } = await supabase
    .from('gl_journal_entries')
    .select('*, gl_journal_lines(*)')
    .eq('id', entryId)
    .single();
  if (entryError || !entry) throw new Error(`Journal entry ${entryId} not found`);

  const voidLines = buildVoidLines(
    entry.gl_journal_lines.map(l => ({ account_id: l.account_id, debit: parseFloat(l.debit), credit: parseFloat(l.credit) }))
  );
  return insertJournalEntry({
    entryDate: new Date().toISOString().split('T')[0],
    description: `Void — ${reason || entry.description}`,
    sourceTable: entry.source_table, sourceId: entry.source_id,
    entryType: 'void', voidsEntryId: entryId, lines: voidLines,
  });
}

// ─── STEP 2B: HIGHER-LEVEL SYNC FUNCTIONS ──────────────────────────────
// Every real write path (15 call sites across FinanceManager.js,
// BookingsManager.js, BookingInvoice.js, GrantsTracker.js,
// BankReconciliation.js) calls one of these after its own write already
// succeeded, rather than each site containing bespoke GL decision logic.
// These deliberately catch and log rather than throw -- a GL posting
// failure must never block or roll back a trustee's save; it becomes a
// visible, fixable gap (logged to console), not a blocked action.

function activeEntries(entries) {
  const voidedIds = new Set(entries.filter(e => e.entry_type === 'void').map(e => e.voids_entry_id));
  return entries.filter(e => e.entry_type !== 'void' && !voidedIds.has(e.id));
}

// Call after any insert/update that changes amount, category, gst_amount,
// or date. Handles the real booking-placeholder case (rows created at
// amount 0, filled in later) -- nothing posts for a zero amount, and an
// existing entry gets voided if a correction brings it back to zero.
export async function syncEntryForAmountChange(row, module) {
  try {
    const sourceTable = module === 'income' ? 'finance_income' : 'finance_expenses';
    const amount = parseFloat(row.amount || 0);
    const entries = await getJournalEntriesForRow(sourceTable, row.id);
    const active = activeEntries(entries);
    const recognition = active.find(e => e.entry_type === 'recognition');
    const clearing = active.find(e => e.entry_type === 'clearing');

    if (amount === 0) {
      if (clearing) await voidJournalEntry(clearing.id, 'Amount corrected to zero');
      if (recognition) await voidJournalEntry(recognition.id, 'Amount corrected to zero');
      return null;
    }

    if (!recognition) {
      return await (module === 'income' ? postIncomeEntry(row) : postExpenseEntry(row));
    }

    // Recognition already exists -- void it (and any clearing, which was
    // calculated against the old amount) and repost fresh from current
    // values. If the row is already Confirmed/Paid, the fresh recognition
    // posts straight to Bank -- a corrected, already-cleared transaction
    // doesn't need to simulate going through AR/AP again.
    if (clearing) await voidJournalEntry(clearing.id, 'Amount changed, reposting');
    await voidJournalEntry(recognition.id, 'Amount changed, reposting');
    return await (module === 'income' ? postIncomeEntry(row) : postExpenseEntry(row));
  } catch (err) {
    console.error('[glPosting] syncEntryForAmountChange failed:', err.message);
    return null;
  }
}

// Call only for a pure status toggle (Pending <-> Confirmed/Paid) where
// amount/category/gst_amount/date are unchanged. Never touches the
// recognition entry -- only posts or voids the separate clearing entry.
export async function syncEntryForStatusChange(row, module) {
  try {
    const sourceTable = module === 'income' ? 'finance_income' : 'finance_expenses';
    const amount = parseFloat(row.amount || 0);
    if (amount === 0) return null; // nothing was ever posted for a zero-amount row

    const entries = await getJournalEntriesForRow(sourceTable, row.id);
    const active = activeEntries(entries);
    const recognition = active.find(e => e.entry_type === 'recognition');
    const clearing = active.find(e => e.entry_type === 'clearing');
    const clearedStatus = module === 'income' ? 'Confirmed' : 'Paid';

    if (!recognition) return null; // nothing recognised yet, nothing to clear

    if (row.status === clearedStatus && !clearing) {
      return await postClearingEntry(row, module);
    }
    if (row.status !== clearedStatus && clearing) {
      return await voidJournalEntry(clearing.id, 'Reverted to Pending');
    }
    return null;
  } catch (err) {
    console.error('[glPosting] syncEntryForStatusChange failed:', err.message);
    return null;
  }
}

// Call before/after deleting a finance_income or finance_expenses row --
// voids whatever's active (recognition and/or clearing) rather than
// assuming a fixed shape.
export async function voidAllEntriesForRow(sourceTable, sourceId, reason) {
  try {
    const entries = await getJournalEntriesForRow(sourceTable, sourceId);
    const active = activeEntries(entries);
    for (const e of active) {
      await voidJournalEntry(e.id, reason);
    }
  } catch (err) {
    console.error('[glPosting] voidAllEntriesForRow failed:', err.message);
  }
}
