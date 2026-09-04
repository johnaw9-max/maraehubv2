import { supabase } from './supabase';

// Stage 2 Step 3 of the General Ledger (ClickUp 14yhc7knyea) -- real
// Trial Balance, Statement of Financial Performance, and Statement of
// Financial Position, computed from genuine gl_journal_lines postings.
//
// gl_accounts deliberately has no entity_id (Step 1's decision, matching
// Xero's own architecture) -- these reports always cover the whole
// organisation, there is no way to scope them to a single entity.

function sumLinesByAccount(lines) {
  const sums = {};
  (lines || []).forEach(l => {
    const cur = sums[l.account_id] || { debit: 0, credit: 0 };
    cur.debit += parseFloat(l.debit || 0);
    cur.credit += parseFloat(l.credit || 0);
    sums[l.account_id] = cur;
  });
  return sums;
}

// A void entry's lines are the exact mirror of what it's voiding, so
// summing debit/credit across ALL lines (recognition + clearing + void,
// no entry_type filtering) already nets to the correct current balance.
export async function getTrialBalance() {
  const [{ data: accounts, error: acctErr }, { data: lines, error: linesErr }] = await Promise.all([
    supabase.from('gl_accounts').select('id, code, name, account_type, normal_balance').order('code'),
    supabase.from('gl_journal_lines').select('account_id, debit, credit'),
  ]);
  if (acctErr) throw new Error(acctErr.message);
  if (linesErr) throw new Error(linesErr.message);

  const sums = sumLinesByAccount(lines);
  const rows = (accounts || []).map(a => {
    const s = sums[a.id] || { debit: 0, credit: 0 };
    const net = s.debit - s.credit;
    return { ...a, totalDebit: s.debit, totalCredit: s.credit, balance: Math.abs(net), balanceSide: net >= 0 ? 'Debit' : 'Credit' };
  });

  const grandTotalDebit = rows.reduce((s, r) => s + r.totalDebit, 0);
  const grandTotalCredit = rows.reduce((s, r) => s + r.totalCredit, 0);

  return { rows, grandTotalDebit, grandTotalCredit, balanced: Math.abs(grandTotalDebit - grandTotalCredit) < 0.01 };
}

// Period-based: sums Revenue/Expense movements whose journal ENTRY date
// falls in [fromDate, toDate]. There's no year-end closing-entry
// mechanism yet, so filtering by date range (not account running-balance)
// is what makes this period-correct.
export async function getStatementOfPerformance(fromDate, toDate) {
  const { data: accounts, error: acctErr } = await supabase
    .from('gl_accounts').select('id, code, name, account_type').in('account_type', ['Revenue', 'Expense']).order('code');
  if (acctErr) throw new Error(acctErr.message);

  const { data: lines, error } = await supabase
    .from('gl_journal_lines')
    .select('account_id, debit, credit, gl_journal_entries!inner(entry_date)')
    .gte('gl_journal_entries.entry_date', fromDate)
    .lte('gl_journal_entries.entry_date', toDate);
  if (error) throw new Error(error.message);

  const sums = sumLinesByAccount(lines);
  const revenueRows = [], expenseRows = [];
  let totalRevenue = 0, totalExpense = 0;
  (accounts || []).forEach(a => {
    const s = sums[a.id] || { debit: 0, credit: 0 };
    if (a.account_type === 'Revenue') {
      const amount = s.credit - s.debit; // normal balance Credit
      if (amount !== 0) { revenueRows.push({ ...a, amount }); totalRevenue += amount; }
    } else {
      const amount = s.debit - s.credit; // normal balance Debit
      if (amount !== 0) { expenseRows.push({ ...a, amount }); totalExpense += amount; }
    }
  });

  return { revenueRows, expenseRows, totalRevenue, totalExpense, netSurplus: totalRevenue - totalExpense };
}

// Point-in-time: sums ALL Asset/Liability/Equity movements up to and
// including asOfDate. These accounts are genuinely cumulative, not
// period-reset, unlike Revenue/Expense above.
export async function getStatementOfPosition(asOfDate) {
  const { data: accounts, error: acctErr } = await supabase
    .from('gl_accounts').select('id, code, name, account_type').in('account_type', ['Asset', 'Liability', 'Equity']).order('code');
  if (acctErr) throw new Error(acctErr.message);

  const { data: lines, error } = await supabase
    .from('gl_journal_lines')
    .select('account_id, debit, credit, gl_journal_entries!inner(entry_date)')
    .lte('gl_journal_entries.entry_date', asOfDate);
  if (error) throw new Error(error.message);

  const sums = sumLinesByAccount(lines);
  const assetRows = [], liabilityRows = [], equityRows = [];
  let totalAssets = 0, totalLiabilities = 0, totalEquity = 0;
  (accounts || []).forEach(a => {
    const s = sums[a.id] || { debit: 0, credit: 0 };
    if (a.account_type === 'Asset') {
      const amount = s.debit - s.credit; // normal balance Debit
      if (amount !== 0) { assetRows.push({ ...a, amount }); totalAssets += amount; }
    } else if (a.account_type === 'Liability') {
      const amount = s.credit - s.debit; // normal balance Credit
      if (amount !== 0) { liabilityRows.push({ ...a, amount }); totalLiabilities += amount; }
    } else {
      const amount = s.credit - s.debit; // Equity, normal balance Credit
      if (amount !== 0) { equityRows.push({ ...a, amount }); totalEquity += amount; }
    }
  });

  return { assetRows, liabilityRows, equityRows, totalAssets, totalLiabilities, totalEquity, netAssets: totalAssets - totalLiabilities };
}
