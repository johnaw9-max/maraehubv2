import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import StatusPill from './StatusPill';
import { ensureTask } from '../lib/taskSync';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const INCOME_CATEGORIES  = ['Booking Income','Grant Income','Koha','Hire Equipment','Fundraiser','Other'];
const EXPENSE_CATEGORIES = ['Maintenance and Repairs','Utilities','Insurance','Events','Administration','Wages','Equipment','Cleaning','Other'];
const INCOME_STATUSES  = ['Confirmed','Pending'];
const EXPENSE_STATUSES = ['Paid','Pending'];

const SECTIONS = [
  { key: 'income',        label: 'Income',        icon: '💵' },
  { key: 'expenses',      label: 'Expenses',       icon: '📤' },
  { key: 'budget',        label: 'Budget',         icon: '📊' },
  { key: 'balance-sheet', label: 'Balance Sheet',  icon: '⚖️' },
  { key: 'reports',       label: 'Reports',        icon: '📋' },
];

const INCOME_CAT_COLORS = {
  'Booking Income':  { bg: '#e8eef8', color: '#1a4a8a' },
  'Grant Income':    { bg: '#e8f4ef', color: '#1a4a3a' },
  'Koha':            { bg: '#f0ecf8', color: '#6b42a8' },
  'Hire Equipment':  { bg: '#fdf0dc', color: '#7a4f00' },
  'Fundraiser':      { bg: '#faeae7', color: '#a63020' },
  'Other':           { bg: '#f5f0e8', color: '#4a4438' },
};

const EXPENSE_CAT_COLORS = {
  'Maintenance and Repairs': { bg: '#faeae7', color: '#a63020' },
  'Utilities':               { bg: '#e8eef8', color: '#1a4a8a' },
  'Insurance':               { bg: '#f0ecf8', color: '#6b42a8' },
  'Events':                  { bg: '#fdf0dc', color: '#7a4f00' },
  'Administration':          { bg: '#f5f0e8', color: '#4a4438' },
  'Wages':                   { bg: '#faeae7', color: '#7a1a1a' },
  'Equipment':               { bg: '#e8f8f4', color: '#0a5a48' },
  'Cleaning':                { bg: '#e8f4ef', color: '#1a4a3a' },
  'Other':                   { bg: '#f5f5f5', color: '#666' },
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function currentFY() {
  const now = new Date();
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
}
function fyLabel(fy) { return `${fy}/${String(fy + 1).slice(2)}`; }
function fyFrom(fy)  { return `${fy}-04-01`; }
function fyTo(fy)    { return `${fy + 1}-03-31`; }

function fmt(d) {
  if (!d) return '—';
  return new Date(d + 'T12:00:00').toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtMoney(n, showSign = false) {
  if (n == null) return '$0.00';
  const abs = Math.abs(n);
  const str = abs.toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (showSign && n < 0) return `-$${str}`;
  if (showSign && n > 0) return `+$${str}`;
  return `$${str}`;
}

function budgetStatus(spent, budget) {
  if (!budget || budget === 0) return 'not_set';
  const pct = spent / budget;
  if (pct > 1) return 'over';
  if (pct >= 0.8) return 'at_risk';
  return 'on_track';
}

const BUDGET_STATUS_CFG = {
  on_track: { label: 'On Track',    bg: '#e8f4ef', color: '#1a4a3a', border: '#a8d8c0', dot: '#2e7d52' },
  at_risk:  { label: 'At Risk',     bg: '#fdf0dc', color: '#7a4f00', border: '#e8c880', dot: '#c8902a' },
  over:     { label: 'Over Budget', bg: '#faeae7', color: '#a63020', border: '#f0b8b0', dot: '#d9534f' },
  not_set:  { label: 'No Budget',   bg: '#f5f0e8', color: '#6b6058', border: '#d9d2c8', dot: '#9a9088' },
};

// ─── EMPTY FORMS ─────────────────────────────────────────────────────────────

const EMPTY_INCOME = {
  date: new Date().toISOString().split('T')[0],
  description: '', amount: '', category: 'Other',
  reference: '', notes: '', status: 'Confirmed',
};
const EMPTY_EXPENSE = {
  date: new Date().toISOString().split('T')[0],
  description: '', amount: '', category: 'Other',
  payee: '', reference: '', notes: '', status: 'Paid',
};

// ─── SECTION HEADER ──────────────────────────────────────────────────────────

function SectionHeader({ icon, title, count, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <span style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, fontWeight: 600, color: 'var(--brand)' }}>{title}</span>
      {count !== undefined && (
        <span style={{ fontSize: 12, background: 'var(--brand)', color: '#fff', borderRadius: 20, padding: '1px 9px', fontWeight: 600 }}>{count}</span>
      )}
      {action && <div style={{ marginLeft: 'auto' }}>{action}</div>}
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function FinanceManager() {
  const fy = currentFY();
  const [section, setSection] = useState('income');

  // Data
  const [income, setIncome]     = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [budgets, setBudgets]   = useState([]);
  const [balanceSheet, setBalanceSheet] = useState(null);
  const [equipmentValue, setEquipmentValue] = useState(0);
  const [contactNames, setContactNames] = useState([]);
  const [loading, setLoading]   = useState(true);

  // Modals
  const [showIncomeModal, setShowIncomeModal]   = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showSyncModal, setShowSyncModal]       = useState(false);
  const [editId, setEditId]       = useState(null);
  const [incomeForm, setIncomeForm]   = useState(EMPTY_INCOME);
  const [expenseForm, setExpenseForm] = useState(EMPTY_EXPENSE);
  const [saving, setSaving]     = useState(false);
  const [formError, setFormError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deleteType, setDeleteType] = useState('');

  // Sync state
  const [syncBookings, setSyncBookings] = useState([]);
  const [syncGrants, setSyncGrants]     = useState([]);
  const [syncLoading, setSyncLoading]   = useState(false);
  const [syncAmounts, setSyncAmounts]   = useState({});

  // Budget editing
  const [budgetEdits, setBudgetEdits] = useState({});
  const [budgetSaving, setBudgetSaving] = useState(false);

  // Balance sheet editing
  const [bsForm, setBsForm] = useState({
    cash_balance: '', other_assets: '', other_assets_notes: '',
    outstanding_payments: '', outstanding_notes: '',
  });
  const [loanRows, setLoanRows] = useState([{ id: 1, name: '', amount: '' }]);
  const [investmentRows, setInvestmentRows] = useState([{ id: 1, name: '', amount: '' }]);
  const [bsId, setBsId] = useState(null);
  const [bsSaving, setBsSaving] = useState(false);
  const [bsSuccess, setBsSuccess] = useState(false);

  // Receipt upload
  const receiptRef = useRef();
  const [receiptFile, setReceiptFile] = useState(null);

  // Reports section state — isolated from all other sections
  const [reportPeriod, setReportPeriod]   = useState('this_fy');
  const [customFrom,   setCustomFrom]     = useState('');
  const [customTo,     setCustomTo]       = useState('');
  const [reportIncome,   setReportIncome]   = useState(null); // null = use current-FY 'income'
  const [reportExpenses, setReportExpenses] = useState(null); // null = use current-FY 'expenses'
  const [reportLoading,  setReportLoading]  = useState(false);

  useEffect(() => { fetchAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (reportPeriod === 'this_fy') {
      setReportIncome(null);
      setReportExpenses(null);
    } else if (reportPeriod === 'prev_fy') {
      fetchReportData(fyFrom(fy - 1), fyTo(fy - 1));
    } else if (reportPeriod === 'custom' && customFrom && customTo && customFrom <= customTo) {
      fetchReportData(customFrom, customTo);
    }
  }, [reportPeriod, customFrom, customTo]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchAll() {
    setLoading(true);
    const [incRes, expRes, budRes, bsRes, assetRes, ctRes] = await Promise.all([
      supabase.from('finance_income').select('*').gte('date', fyFrom(fy)).lte('date', fyTo(fy)).order('date', { ascending: false }),
      supabase.from('finance_expenses').select('*').gte('date', fyFrom(fy)).lte('date', fyTo(fy)).order('date', { ascending: false }),
      supabase.from('finance_budgets').select('*').eq('financial_year', fy),
      supabase.from('finance_balance_sheet').select('*').limit(1).single(),
      supabase.from('assets').select('value'),
      supabase.from('contacts').select('full_name').order('full_name'),
    ]);
    setIncome(incRes.data || []);
    setExpenses(expRes.data || []);
    setBudgets(budRes.data || []);
    const bs = bsRes.data;
    if (bs) {
      setBsId(bs.id);
      setBsForm({
        cash_balance:         bs.cash_balance ?? '',
        other_assets:         bs.other_assets ?? '',
        other_assets_notes:   bs.other_assets_notes || '',
        outstanding_payments: bs.outstanding_payments ?? '',
        outstanding_notes:    bs.outstanding_notes || '',
      });
      try {
        const parsed = JSON.parse(bs.loans_notes || '[]');
        if (Array.isArray(parsed) && parsed.length > 0) {
          setLoanRows(parsed.map((r, i) => ({ id: i + 1, name: r.name || '', amount: r.amount ?? '' })));
        } else {
          const oldAmt = parseFloat(bs.loans || 0);
          setLoanRows([{ id: 1, name: oldAmt > 0 ? (bs.loans_notes || '') : '', amount: oldAmt > 0 ? String(oldAmt) : '' }]);
        }
      } catch {
        const oldAmt = parseFloat(bs.loans || 0);
        setLoanRows([{ id: 1, name: bs.loans_notes || '', amount: oldAmt > 0 ? String(oldAmt) : '' }]);
      }
      try {
        const parsed = JSON.parse(bs.investments_notes || '[]');
        if (Array.isArray(parsed) && parsed.length > 0) {
          setInvestmentRows(parsed.map((r, i) => ({ id: i + 1, name: r.name || '', amount: r.amount ?? '' })));
        } else {
          const oldRows = [];
          if (parseFloat(bs.term_deposits || 0) > 0) oldRows.push({ id: 1, name: 'Term Deposits', amount: String(bs.term_deposits) });
          if (parseFloat(bs.shares_bonds || 0) > 0) oldRows.push({ id: 2, name: 'Shares & Bonds', amount: String(bs.shares_bonds) });
          if (parseFloat(bs.property_investments || 0) > 0) oldRows.push({ id: 3, name: 'Property Investments', amount: String(bs.property_investments) });
          if (parseFloat(bs.other_investments || 0) > 0) oldRows.push({ id: 4, name: 'Other Investments', amount: String(bs.other_investments) });
          setInvestmentRows(oldRows.length > 0 ? oldRows : [{ id: 1, name: '', amount: '' }]);
        }
      } catch {
        setInvestmentRows([{ id: 1, name: '', amount: '' }]);
      }
      setBalanceSheet(bs);
    }
    const eqVal = (assetRes.data || []).reduce((s, a) => s + (parseFloat(a.value) || 0), 0);
    setEquipmentValue(eqVal);
    setContactNames((ctRes.data || []).map(c => c.full_name).filter(Boolean));
    setLoading(false);
    createBudgetTasks(budRes.data || [], expRes.data || []);
  }

  // ── REPORT-PERIOD DATA FETCH (Reports tab only — does not affect other sections) ──

  async function fetchReportData(from, to) {
    setReportLoading(true);
    const [incRes, expRes] = await Promise.all([
      supabase.from('finance_income').select('*').gte('date', from).lte('date', to).order('date'),
      supabase.from('finance_expenses').select('*').gte('date', from).lte('date', to).order('date'),
    ]);
    setReportIncome(incRes.data || []);
    setReportExpenses(expRes.data || []);
    setReportLoading(false);
  }

  // ── BUDGET OVER-BUDGET TASKS ───────────────────────────────────────────────

  async function createBudgetTasks(budgetData, expenseData) {
    const spentByCategory = {};
    expenseData.forEach(e => {
      spentByCategory[e.category] = (spentByCategory[e.category] || 0) + parseFloat(e.amount || 0);
    });
    for (const b of budgetData) {
      if (!b.amount || b.amount === 0) continue;
      const spent = spentByCategory[b.category] || 0;
      if (spent > parseFloat(b.amount)) {
        await ensureTask({
          title: `FINANCE: Over budget — ${b.category}`,
          description: `Budget category over limit this financial year. Budget: $${b.amount}, Spent: $${spent.toFixed(2)}. Review spending and update budget. [source_id:${b.id}]`,
          assigned_to: null,
          due_date: fyTo(fy),
          priority: 'Medium',
        });
      }
    }
  }

  // ── COMPUTED TOTALS ────────────────────────────────────────────────────────

  const totals = useMemo(() => {
    const totalIncome   = income.reduce((s, i) => s + parseFloat(i.amount || 0), 0);
    const totalExpenses = expenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
    const net = totalIncome - totalExpenses;
    const budgetMap = {};
    budgets.forEach(b => { budgetMap[b.category] = parseFloat(b.amount || 0); });
    const spentMap = {};
    expenses.forEach(e => { spentMap[e.category] = (spentMap[e.category] || 0) + parseFloat(e.amount || 0); });
    const overBudget = EXPENSE_CATEGORIES.filter(c => {
      const budget = budgetMap[c] || 0;
      const spent = spentMap[c] || 0;
      return budget > 0 && spent > budget;
    }).length;
    return { totalIncome, totalExpenses, net, budgetMap, spentMap, overBudget };
  }, [income, expenses, budgets]);

  // ── REPORT-PERIOD DERIVED TOTALS (Reports tab only) ───────────────────────

  const rIncome   = reportIncome   !== null ? reportIncome   : income;
  const rExpenses = reportExpenses !== null ? reportExpenses : expenses;

  const periodLabel = reportPeriod === 'this_fy'
    ? `FY ${fyLabel(fy)}`
    : reportPeriod === 'prev_fy'
    ? `FY ${fyLabel(fy - 1)}`
    : (customFrom && customTo ? `${fmt(customFrom)} to ${fmt(customTo)}` : 'Custom Range');

  const reportTotals = useMemo(() => {
    const rInc = reportIncome !== null ? reportIncome : income;
    const rExp = reportExpenses !== null ? reportExpenses : expenses;
    const totalIncome   = rInc.reduce((s, i) => s + parseFloat(i.amount || 0), 0);
    const totalExpenses = rExp.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
    const net = totalIncome - totalExpenses;
    const spentMap = {};
    rExp.forEach(e => { spentMap[e.category] = (spentMap[e.category] || 0) + parseFloat(e.amount || 0); });
    return { totalIncome, totalExpenses, net, spentMap };
  }, [reportIncome, reportExpenses, income, expenses]);

  // ── INCOME CRUD ────────────────────────────────────────────────────────────

  function openAddIncome() {
    setIncomeForm(EMPTY_INCOME); setEditId(null);
    setFormError(''); setShowIncomeModal(true);
  }

  function openEditIncome(row) {
    setIncomeForm({
      date: row.date || '', description: row.description || '',
      amount: row.amount != null ? String(row.amount) : '',
      category: row.category || 'Other',
      reference: row.reference || '', notes: row.notes || '',
      status: row.status || 'Confirmed',
    });
    setEditId(row.id); setFormError(''); setShowIncomeModal(true);
  }

  async function handleSaveIncome() {
    if (!incomeForm.description.trim()) { setFormError('Description is required.'); return; }
    if (!incomeForm.date) { setFormError('Date is required.'); return; }
    if (incomeForm.amount === '' || isNaN(parseFloat(incomeForm.amount))) { setFormError('Amount is required.'); return; }
    setSaving(true); setFormError('');
    const payload = {
      date: incomeForm.date,
      description: incomeForm.description.trim(),
      amount: parseFloat(incomeForm.amount),
      category: incomeForm.category,
      reference: incomeForm.reference.trim() || null,
      notes: incomeForm.notes.trim() || null,
      status: incomeForm.status,
    };
    const { error } = editId
      ? await supabase.from('finance_income').update(payload).eq('id', editId)
      : await supabase.from('finance_income').insert(payload);
    if (error) { setFormError(error.message); setSaving(false); return; }
    setSaving(false); setShowIncomeModal(false); fetchAll();
  }

  // ── EXPENSE CRUD ───────────────────────────────────────────────────────────

  function openAddExpense() {
    setExpenseForm(EMPTY_EXPENSE); setEditId(null); setReceiptFile(null);
    setFormError(''); setShowExpenseModal(true);
  }

  function openEditExpense(row) {
    setExpenseForm({
      date: row.date || '', description: row.description || '',
      amount: row.amount != null ? String(row.amount) : '',
      category: row.category || 'Other', payee: row.payee || '',
      reference: row.reference || '', notes: row.notes || '',
      status: row.status || 'Paid',
    });
    setEditId(row.id); setReceiptFile(null); setFormError(''); setShowExpenseModal(true);
  }

  async function handleSaveExpense() {
    if (!expenseForm.description.trim()) { setFormError('Description is required.'); return; }
    if (!expenseForm.date) { setFormError('Date is required.'); return; }
    if (expenseForm.amount === '' || isNaN(parseFloat(expenseForm.amount))) { setFormError('Amount is required.'); return; }
    setSaving(true); setFormError('');

    let receipt_url = null, receipt_name = null;
    if (editId) {
      const existing = expenses.find(e => e.id === editId);
      receipt_url = existing?.receipt_url || null;
      receipt_name = existing?.receipt_name || null;
    }
    if (receiptFile) {
      const path = `receipts/${Date.now()}-${receiptFile.name.replace(/\s+/g, '_')}`;
      const { error: upErr } = await supabase.storage.from('finance-receipts').upload(path, receiptFile);
      if (!upErr) {
        const { data } = supabase.storage.from('finance-receipts').getPublicUrl(path);
        receipt_url = data?.publicUrl || null;
        receipt_name = receiptFile.name;
      }
    }

    const payload = {
      date: expenseForm.date, description: expenseForm.description.trim(),
      amount: parseFloat(expenseForm.amount), category: expenseForm.category,
      payee: expenseForm.payee.trim() || null, reference: expenseForm.reference.trim() || null,
      notes: expenseForm.notes.trim() || null, status: expenseForm.status,
      receipt_url, receipt_name,
    };
    const { error } = editId
      ? await supabase.from('finance_expenses').update(payload).eq('id', editId)
      : await supabase.from('finance_expenses').insert(payload);
    if (error) { setFormError(error.message); setSaving(false); return; }
    setSaving(false); setShowExpenseModal(false); fetchAll();
  }

  async function handleDelete() {
    if (!confirmDeleteId || !deleteType) return;
    await supabase.from(deleteType === 'income' ? 'finance_income' : 'finance_expenses').delete().eq('id', confirmDeleteId);
    setConfirmDeleteId(null); setDeleteType('');
    fetchAll();
  }

  // ── AUTO-SYNC ──────────────────────────────────────────────────────────────

  async function openSyncModal() {
    setSyncLoading(true); setShowSyncModal(true); setSyncAmounts({});

    const existingSourceIds = new Set(income.filter(i => i.source_id).map(i => i.source_id));

    const [bookRes, grantRes] = await Promise.all([
      supabase.from('bookings').select('id, occasion, start_date, guests').eq('status', 'approved').order('start_date', { ascending: false }),
      supabase.from('grants').select('id, name, funder, amount').eq('status', 'approved'),
    ]);

    setSyncBookings((bookRes.data || []).filter(b => !existingSourceIds.has(b.id)));
    setSyncGrants((grantRes.data  || []).filter(g => !existingSourceIds.has(g.id)));
    setSyncLoading(false);
  }

  async function handleSyncGrant(grant) {
    const today = new Date().toISOString().split('T')[0];
    await supabase.from('finance_income').insert({
      date: today,
      description: `Grant income — ${grant.name} (${grant.funder || 'unknown funder'})`,
      amount: parseFloat(grant.amount || 0),
      category: 'Grant Income',
      status: 'Confirmed',
      source_type: 'grant',
      source_id: grant.id,
    });
    setSyncGrants(g => g.filter(x => x.id !== grant.id));
    fetchAll();
  }

  async function handleSyncBooking(booking) {
    const amount = parseFloat(syncAmounts[booking.id] || 0);
    if (!amount) return;
    await supabase.from('finance_income').insert({
      date: booking.start_date,
      description: `Booking income — ${booking.occasion}`,
      amount,
      category: 'Booking Income',
      status: 'Confirmed',
      source_type: 'booking',
      source_id: booking.id,
    });
    setSyncBookings(b => b.filter(x => x.id !== booking.id));
    fetchAll();
  }

  // ── BUDGET SAVE ────────────────────────────────────────────────────────────

  async function handleSaveBudgets() {
    setBudgetSaving(true);
    const upserts = EXPENSE_CATEGORIES.map(cat => ({
      financial_year: fy,
      category: cat,
      amount: parseFloat(budgetEdits[cat] ?? (totals.budgetMap[cat] || 0)),
      updated_at: new Date().toISOString(),
    }));
    await supabase.from('finance_budgets').upsert(upserts, { onConflict: 'financial_year,category' });
    setBudgetEdits({});
    setBudgetSaving(false);
    fetchAll();
  }

  // ── BALANCE SHEET SAVE ─────────────────────────────────────────────────────

  async function handleSaveBalanceSheet() {
    setBsSaving(true);
    const loansTotal = loanRows.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
    const investmentsTotal = investmentRows.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
    const payload = {
      cash_balance:         parseFloat(bsForm.cash_balance || 0),
      other_assets:         parseFloat(bsForm.other_assets || 0),
      other_assets_notes:   bsForm.other_assets_notes || null,
      term_deposits:        0,
      shares_bonds:         0,
      property_investments: 0,
      other_investments:    investmentsTotal,
      investments_notes:    JSON.stringify(investmentRows.map(r => ({ name: r.name.trim(), amount: r.amount }))),
      loans:                loansTotal,
      loans_notes:          JSON.stringify(loanRows.map(r => ({ name: r.name.trim(), amount: r.amount }))),
      outstanding_payments: parseFloat(bsForm.outstanding_payments || 0),
      outstanding_notes:    bsForm.outstanding_notes || null,
      updated_at: new Date().toISOString(),
    };
    if (bsId) {
      await supabase.from('finance_balance_sheet').update(payload).eq('id', bsId);
    } else {
      const { data } = await supabase.from('finance_balance_sheet').insert(payload).select('id').single();
      if (data) setBsId(data.id);
    }
    setBsSaving(false);
    setBsSuccess(true);
    setTimeout(() => setBsSuccess(false), 3000);
    fetchAll();
  }

  // ── BALANCE SHEET ROW HELPERS ─────────────────────────────────────────────

  function addLoanRow() { setLoanRows(r => [...r, { id: Date.now(), name: '', amount: '' }]); }
  function removeLoanRow(id) { setLoanRows(r => r.filter(x => x.id !== id)); }
  function updateLoanRow(id, field, value) { setLoanRows(r => r.map(x => x.id === id ? { ...x, [field]: value } : x)); }
  function addInvestmentRow() { setInvestmentRows(r => [...r, { id: Date.now(), name: '', amount: '' }]); }
  function removeInvestmentRow(id) { setInvestmentRows(r => r.filter(x => x.id !== id)); }
  function updateInvestmentRow(id, field, value) { setInvestmentRows(r => r.map(x => x.id === id ? { ...x, [field]: value } : x)); }

  // ── INCOME STATUS CHANGE ───────────────────────────────────────────────────

  async function handleIncomeStatus(row, s) {
    await supabase.from('finance_income').update({ status: s }).eq('id', row.id);
    setIncome(prev => prev.map(i => i.id === row.id ? { ...i, status: s } : i));
  }

  async function handleExpenseStatus(row, s) {
    await supabase.from('finance_expenses').update({ status: s }).eq('id', row.id);
    setExpenses(prev => prev.map(e => e.id === row.id ? { ...e, status: e.id === row.id ? s : e.status } : e));
  }

  // ── AGM REPORT ─────────────────────────────────────────────────────────────

  function printAGMReport() {
    const win = window.open('', '_blank');
    const bs = balanceSheet;
    const bsInvTotal = parseFloat(bs?.other_investments || 0);
    const totalAssets = (parseFloat(bs?.cash_balance || 0) + parseFloat(bs?.other_assets || 0) + bsInvTotal + equipmentValue).toFixed(2);
    const totalLiabilities = (parseFloat(bs?.loans || 0) + parseFloat(bs?.outstanding_payments || 0)).toFixed(2);
    let parsedLoans = []; try { parsedLoans = JSON.parse(bs?.loans_notes || '[]'); if (!Array.isArray(parsedLoans)) parsedLoans = []; } catch { parsedLoans = []; }
    let parsedInvestments = []; try { parsedInvestments = JSON.parse(bs?.investments_notes || '[]'); if (!Array.isArray(parsedInvestments)) parsedInvestments = []; } catch { parsedInvestments = []; }
    const loanHtml = parsedLoans.length > 0
      ? parsedLoans.map(r => `<tr><td>Loan${r.name ? ' — ' + r.name : ''}</td><td style="text-align:right">${fmtMoney(parseFloat(r.amount || 0))}</td></tr>`).join('')
      : `<tr><td>Loans</td><td style="text-align:right">${fmtMoney(bs?.loans || 0)}</td></tr>`;
    const investmentHtml = parsedInvestments.length > 0
      ? parsedInvestments.map(r => `<tr><td>${r.name || 'Investment'}</td><td style="text-align:right">${fmtMoney(parseFloat(r.amount || 0))}</td></tr>`).join('')
      : (bsInvTotal > 0 ? `<tr><td>Investments</td><td style="text-align:right">${fmtMoney(bsInvTotal)}</td></tr>` : '');
    const netWorth = (parseFloat(totalAssets) - parseFloat(totalLiabilities)).toFixed(2);

    const incomeRows = INCOME_CATEGORIES.map(cat => {
      const total = income.filter(i => i.category === cat).reduce((s, i) => s + parseFloat(i.amount || 0), 0);
      return total > 0 ? `<tr><td>${cat}</td><td style="text-align:right">${fmtMoney(total)}</td></tr>` : '';
    }).join('');

    const expenseRows = EXPENSE_CATEGORIES.map(cat => {
      const spent  = totals.spentMap[cat] || 0;
      const budget = totals.budgetMap[cat] || 0;
      const status = budgetStatus(spent, budget);
      const colour = status === 'over' ? '#a63020' : status === 'at_risk' ? '#c8902a' : '#2e7d52';
      return `<tr><td>${cat}</td><td style="text-align:right">${fmtMoney(spent)}</td><td style="text-align:right">${budget ? fmtMoney(budget) : '—'}</td><td style="text-align:right;color:${colour}">${budget ? Math.round((spent/budget)*100) + '%' : '—'}</td></tr>`;
    }).join('');

    win.document.write(`<!DOCTYPE html><html><head><title>AGM Finance Report ${fyLabel(fy)}</title>
<style>body{font-family:Georgia,serif;max-width:800px;margin:40px auto;color:#222;line-height:1.6}h1{font-size:24px;border-bottom:2px solid #1a4a3a;padding-bottom:8px}h2{font-size:16px;margin-top:28px;color:#1a4a3a}table{width:100%;border-collapse:collapse;margin:12px 0}th{text-align:left;padding:6px 8px;background:#f0f0f0;font-size:13px}td{padding:6px 8px;border-bottom:1px solid #eee;font-size:13px}.net{font-size:18px;font-weight:bold;padding:12px 0}.surplus{color:#1a4a3a}.deficit{color:#a63020}</style>
</head><body>
<h1>Finance Report — ${fyLabel(fy)} Financial Year</h1>
<p style="color:#666;font-size:13px">Prepared for Annual General Meeting · ${new Date().toLocaleDateString('en-NZ',{day:'numeric',month:'long',year:'numeric'})}</p>
<h2>Income</h2><table><tr><th>Category</th><th style="text-align:right">Amount</th></tr>${incomeRows}<tr style="font-weight:bold;border-top:2px solid #ccc"><td>Total Income</td><td style="text-align:right">${fmtMoney(totals.totalIncome)}</td></tr></table>
<h2>Expenditure vs Budget</h2><table><tr><th>Category</th><th style="text-align:right">Actual</th><th style="text-align:right">Budget</th><th style="text-align:right">Used</th></tr>${expenseRows}<tr style="font-weight:bold;border-top:2px solid #ccc"><td>Total Expenses</td><td style="text-align:right">${fmtMoney(totals.totalExpenses)}</td><td></td><td></td></tr></table>
<div class="net ${totals.net >= 0 ? 'surplus' : 'deficit'}">${totals.net >= 0 ? 'Net Surplus' : 'Net Deficit'}: ${fmtMoney(Math.abs(totals.net))}</div>
<h2>Balance Sheet Snapshot</h2><table>
<tr><th>Assets</th><th style="text-align:right">Value</th></tr>
<tr><td>Cash &amp; Bank Balance</td><td style="text-align:right">${fmtMoney(bs?.cash_balance || 0)}</td></tr>
<tr><td>Equipment (Assets Register)</td><td style="text-align:right">${fmtMoney(equipmentValue)}</td></tr>
${parseFloat(bs?.other_assets || 0) > 0 ? `<tr><td>Other Assets${bs?.other_assets_notes ? ' — ' + bs.other_assets_notes : ''}</td><td style="text-align:right">${fmtMoney(bs?.other_assets || 0)}</td></tr>` : ''}
${investmentHtml}
<tr style="font-weight:bold"><td>Total Assets</td><td style="text-align:right">$${totalAssets}</td></tr>
<tr><th>Liabilities</th><th></th></tr>
${loanHtml}
<tr><td>Outstanding Payments${bs?.outstanding_notes ? ' — ' + bs.outstanding_notes : ''}</td><td style="text-align:right">${fmtMoney(bs?.outstanding_payments || 0)}</td></tr>
<tr style="font-weight:bold"><td>Total Liabilities</td><td style="text-align:right">$${totalLiabilities}</td></tr>
<tr style="font-weight:bold;font-size:15px"><td>Net Worth</td><td style="text-align:right;color:${parseFloat(netWorth) >= 0 ? '#1a4a3a' : '#a63020'}">$${netWorth}</td></tr>
</table>
<p style="font-size:11px;color:#999;margin-top:32px">Generated by MaraeHub · maraehub.com</p>
</body></html>`);
    win.document.close();
    win.print();
  }

  // ── GENERAL LEDGER PRINT (Reports tab only) ────────────────────────────────

  function printGeneralLedger() {
    const rInc = reportIncome  !== null ? reportIncome  : income;
    const rExp = reportExpenses !== null ? reportExpenses : expenses;

    const txns = [
      ...rInc.map(r => ({ date: r.date, description: r.description, category: r.category, inc: parseFloat(r.amount || 0), exp: 0 })),
      ...rExp.map(r => ({ date: r.date, description: r.description, category: r.category, inc: 0, exp: parseFloat(r.amount || 0) })),
    ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    const openingBalance = 0;
    let running = openingBalance;
    const ledgerRows = txns.map(t => {
      running += t.inc - t.exp;
      return { ...t, balance: running };
    });
    const closingBalance = running;

    const rTotInc = rInc.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
    const rTotExp = rExp.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
    const rNet    = rTotInc - rTotExp;

    const glLabel = reportPeriod === 'this_fy'
      ? `FY ${fyLabel(fy)}`
      : reportPeriod === 'prev_fy'
      ? `FY ${fyLabel(fy - 1)}`
      : (customFrom && customTo ? `${fmt(customFrom)} to ${fmt(customTo)}` : 'Custom Range');

    const rowsHtml = ledgerRows.map(r => `
      <tr>
        <td style="white-space:nowrap">${fmt(r.date)}</td>
        <td>${r.description || '—'}</td>
        <td>${r.category}</td>
        <td style="text-align:right;color:#1a4a3a">${r.inc > 0 ? fmtMoney(r.inc) : ''}</td>
        <td style="text-align:right;color:#a63020">${r.exp > 0 ? fmtMoney(r.exp) : ''}</td>
        <td style="text-align:right;font-weight:600;color:${r.balance >= 0 ? '#1a4a3a' : '#a63020'}">${fmtMoney(r.balance)}</td>
      </tr>`).join('');

    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><title>General Ledger — ${glLabel}</title>
<style>
  body{font-family:Georgia,serif;max-width:920px;margin:40px auto;color:#222;line-height:1.6}
  h1{font-size:22px;border-bottom:2px solid #1a4a3a;padding-bottom:8px}
  h2{font-size:14px;margin-top:24px;color:#1a4a3a;border-bottom:1px solid #ddd;padding-bottom:4px}
  table{width:100%;border-collapse:collapse;margin:10px 0;font-size:12px}
  th{text-align:left;padding:7px 10px;background:#f0f0f0;font-size:11px;font-weight:700;border-bottom:2px solid #ccc}
  td{padding:6px 10px;border-bottom:1px solid #eee}
  .balance-row{background:#f5f5f5;font-weight:700;font-size:13px}
  .summary{display:flex;gap:20px;margin:16px 0}
  .s-card{flex:1;padding:12px 16px;border-radius:6px;border:1px solid #ddd}
</style>
</head><body>
<h1>General Ledger — ${glLabel}</h1>
<p style="color:#666;font-size:13px">Prepared ${new Date().toLocaleDateString('en-NZ',{day:'numeric',month:'long',year:'numeric'})}</p>
<div class="summary">
  <div class="s-card" style="background:#f5f5f5;border-color:#ccc">
    <div style="font-size:11px;color:#555">Opening Balance</div>
    <div style="font-size:18px;font-weight:700;color:#333">${fmtMoney(openingBalance)}</div>
  </div>
  <div class="s-card" style="background:#e8eef8;border-color:#a8c0d8">
    <div style="font-size:11px;color:#555">Total Transactions</div>
    <div style="font-size:18px;font-weight:700;color:#1a4a8a">${ledgerRows.length}</div>
  </div>
  <div class="s-card" style="background:#e8f4ef;border-color:#a8d8c0">
    <div style="font-size:11px;color:#555">Total Income</div>
    <div style="font-size:18px;font-weight:700;color:#1a4a3a">${fmtMoney(rTotInc)}</div>
  </div>
  <div class="s-card" style="background:#faeae7;border-color:#f0b8b0">
    <div style="font-size:11px;color:#555">Total Expenses</div>
    <div style="font-size:18px;font-weight:700;color:#a63020">${fmtMoney(rTotExp)}</div>
  </div>
  <div class="s-card" style="background:${closingBalance >= 0 ? '#e8f4ef' : '#faeae7'};border-color:${closingBalance >= 0 ? '#a8d8c0' : '#f0b8b0'}">
    <div style="font-size:11px;color:#555">Closing Balance</div>
    <div style="font-size:18px;font-weight:700;color:${closingBalance >= 0 ? '#1a4a3a' : '#a63020'}">${fmtMoney(closingBalance)}</div>
  </div>
</div>
<table>
  <thead>
    <tr>
      <th style="width:105px">Date</th>
      <th>Description</th>
      <th style="width:155px">Category</th>
      <th style="text-align:right;width:100px">Income</th>
      <th style="text-align:right;width:100px">Expense</th>
      <th style="text-align:right;width:120px">Running Balance</th>
    </tr>
  </thead>
  <tbody>
    <tr class="balance-row"><td colspan="5">Opening Balance</td><td style="text-align:right">${fmtMoney(openingBalance)}</td></tr>
    ${rowsHtml}
    <tr class="balance-row"><td colspan="5">Closing Balance</td><td style="text-align:right;color:${closingBalance >= 0 ? '#1a4a3a' : '#a63020'}">${fmtMoney(closingBalance)}</td></tr>
  </tbody>
</table>
<h2>Period Summary</h2>
<table style="max-width:380px">
  <tr><td>Total Income</td><td style="text-align:right;color:#1a4a3a;font-weight:600">${fmtMoney(rTotInc)}</td></tr>
  <tr><td>Total Expenses</td><td style="text-align:right;color:#a63020;font-weight:600">${fmtMoney(rTotExp)}</td></tr>
  <tr style="font-weight:bold;border-top:2px solid #ccc"><td>${rNet >= 0 ? 'Net Surplus' : 'Net Deficit'}</td><td style="text-align:right;color:${rNet >= 0 ? '#1a4a3a' : '#a63020'}">${fmtMoney(Math.abs(rNet))}</td></tr>
</table>
<p style="font-size:11px;color:#999;margin-top:32px">Generated by MaraeHub · maraehub.com</p>
</body></html>`);
    win.document.close();
    win.print();
  }

  if (loading) return <div className="loading">Loading finance data...</div>;

  // ── COMPUTED BALANCE SHEET ─────────────────────────────────────────────────

  const bsCash        = parseFloat(balanceSheet?.cash_balance || 0);
  const bsOther       = parseFloat(balanceSheet?.other_assets || 0);
  const bsInvestments = parseFloat(balanceSheet?.other_investments || 0);
  const bsLoans       = parseFloat(balanceSheet?.loans || 0);
  const bsOutstanding = parseFloat(balanceSheet?.outstanding_payments || 0);
  const totalAssets      = bsCash + bsOther + bsInvestments + equipmentValue;
  const totalLiabilities = bsLoans + bsOutstanding;
  const netWorth         = totalAssets - totalLiabilities;

  const loansTotal           = loanRows.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
  const investmentsTotal     = investmentRows.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
  const liveTotalAssets      = parseFloat(bsForm.cash_balance || 0) + parseFloat(bsForm.other_assets || 0) + investmentsTotal + equipmentValue;
  const liveTotalLiabilities = loansTotal + parseFloat(bsForm.outstanding_payments || 0);
  const liveNetWorth         = liveTotalAssets - liveTotalLiabilities;

  // ── KPI TILES ─────────────────────────────────────────────────────────────

  const KPI_TILES = [
    {
      label: 'Total Income',
      value: fmtMoney(totals.totalIncome),
      icon: '💵',
      bg: '#e8f4ef',
      valueColor: 'var(--brand)',
    },
    {
      label: 'Total Expenses',
      value: fmtMoney(totals.totalExpenses),
      icon: '📤',
      bg: '#faeae7',
      valueColor: totals.totalExpenses > totals.totalIncome ? 'var(--danger)' : 'var(--text1)',
    },
    {
      label: totals.net >= 0 ? 'Net Surplus' : 'Net Deficit',
      value: fmtMoney(Math.abs(totals.net)),
      icon: totals.net >= 0 ? '✅' : '⚠️',
      bg: totals.net >= 0 ? '#e8f4ef' : '#faeae7',
      valueColor: totals.net >= 0 ? 'var(--brand)' : 'var(--danger)',
    },
    {
      label: 'Over Budget',
      value: totals.overBudget,
      icon: '📊',
      bg: totals.overBudget > 0 ? '#faeae7' : '#f5f5f5',
      valueColor: totals.overBudget > 0 ? 'var(--danger)' : 'var(--text3)',
    },
  ];

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* ── KPI TILES ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {KPI_TILES.map((t, i) => (
          <div key={i} className="panel" style={{ textAlign: 'center', padding: '14px 10px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, margin: '0 auto 8px' }}>
              {t.icon}
            </div>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, fontWeight: 600, color: t.valueColor, marginBottom: 4 }}>
              {t.value}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500 }}>{t.label}</div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>FY {fyLabel(fy)}</div>
          </div>
        ))}
      </div>

      {/* ── SECTION TABS ───────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', borderBottom: '2px solid var(--border)', marginBottom: 20, gap: 0 }}>
        {SECTIONS.map(s => (
          <button
            key={s.key}
            onClick={() => setSection(s.key)}
            style={{
              padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: 'none', border: 'none', fontFamily: 'DM Sans, sans-serif',
              color: section === s.key ? 'var(--brand)' : 'var(--text3)',
              borderBottom: section === s.key ? '2px solid var(--brand)' : '2px solid transparent',
              marginBottom: -2,
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <span>{s.icon}</span>{s.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION: INCOME
      ══════════════════════════════════════════════════════════════════════ */}
      {section === 'income' && (
        <div>
          <SectionHeader
            icon="💵" title="Income" count={income.length}
            action={
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-secondary" onClick={openSyncModal} style={{ fontSize: 12, padding: '7px 14px' }}>
                  ↓ Re-sync / Backup
                </button>
                <button className="btn-primary" onClick={openAddIncome} style={{ fontSize: 13 }}>
                  + Add Income
                </button>
              </div>
            }
          />

          {income.length === 0 ? (
            <div className="empty-state"><div className="emoji">💵</div><div>No income recorded for FY {fyLabel(fy)}</div></div>
          ) : (
            <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--surface2)', borderBottom: '2px solid var(--border)' }}>
                    {['Date','Description','Category','Amount','Reference','Status',''].map((h, i) => (
                      <th key={i} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textAlign: i >= 3 ? 'right' : 'left', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {income.map(row => {
                    const catC = INCOME_CAT_COLORS[row.category] || INCOME_CAT_COLORS.Other;
                    return (
                      <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{fmt(row.date)}</td>
                        <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text1)', maxWidth: 260 }}>
                          <div style={{ fontWeight: 500 }}>{row.description}</div>
                          {row.notes && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{row.notes}</div>}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ fontSize: 11, fontWeight: 600, background: catC.bg, color: catC.color, borderRadius: 20, padding: '2px 9px', whiteSpace: 'nowrap' }}>
                            {row.category}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: 'var(--brand)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {fmtMoney(row.amount)}
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 11, color: 'var(--text3)', textAlign: 'right' }}>{row.reference || '—'}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                          <StatusPill status={row.status} options={INCOME_STATUSES} onStatusChange={s => handleIncomeStatus(row, s)} />
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button onClick={() => openEditIncome(row)} style={{ fontSize: 11, color: 'var(--brand)', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 9px', cursor: 'pointer', marginRight: 4 }}>Edit</button>
                          <button onClick={() => { setConfirmDeleteId(row.id); setDeleteType('income'); }} style={{ fontSize: 11, color: 'var(--danger)', background: 'none', border: '1px solid #f0b8b0', borderRadius: 6, padding: '3px 7px', cursor: 'pointer' }}>✕</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--surface2)', borderTop: '2px solid var(--border)' }}>
                    <td colSpan={3} style={{ padding: '10px 14px', fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>Total Income — FY {fyLabel(fy)}</td>
                    <td style={{ padding: '10px 14px', fontSize: 14, fontWeight: 700, color: 'var(--brand)', textAlign: 'right' }}>{fmtMoney(totals.totalIncome)}</td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION: EXPENSES
      ══════════════════════════════════════════════════════════════════════ */}
      {section === 'expenses' && (
        <div>
          <SectionHeader
            icon="📤" title="Expenses" count={expenses.length}
            action={<button className="btn-primary" onClick={openAddExpense} style={{ fontSize: 13 }}>+ Add Expense</button>}
          />

          {expenses.length === 0 ? (
            <div className="empty-state"><div className="emoji">📤</div><div>No expenses recorded for FY {fyLabel(fy)}</div></div>
          ) : (
            <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--surface2)', borderBottom: '2px solid var(--border)' }}>
                    {['Date','Description','Category','Payee','Amount','Ref','Status',''].map((h, i) => (
                      <th key={i} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textAlign: i >= 4 ? 'right' : 'left', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {expenses.map(row => {
                    const catC = EXPENSE_CAT_COLORS[row.category] || EXPENSE_CAT_COLORS.Other;
                    return (
                      <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{fmt(row.date)}</td>
                        <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text1)', maxWidth: 200 }}>
                          <div style={{ fontWeight: 500 }}>{row.description}</div>
                          {row.receipt_url && <a href={row.receipt_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: 'var(--brand)' }}>📎 Receipt</a>}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ fontSize: 11, fontWeight: 600, background: catC.bg, color: catC.color, borderRadius: 20, padding: '2px 9px', whiteSpace: 'nowrap' }}>{row.category}</span>
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text3)' }}>{row.payee || '—'}</td>
                        <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: 'var(--danger)', textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtMoney(row.amount)}</td>
                        <td style={{ padding: '10px 14px', fontSize: 11, color: 'var(--text3)', textAlign: 'right' }}>{row.reference || '—'}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                          <StatusPill status={row.status} options={EXPENSE_STATUSES} onStatusChange={s => handleExpenseStatus(row, s)} />
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button onClick={() => openEditExpense(row)} style={{ fontSize: 11, color: 'var(--brand)', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 9px', cursor: 'pointer', marginRight: 4 }}>Edit</button>
                          <button onClick={() => { setConfirmDeleteId(row.id); setDeleteType('expenses'); }} style={{ fontSize: 11, color: 'var(--danger)', background: 'none', border: '1px solid #f0b8b0', borderRadius: 6, padding: '3px 7px', cursor: 'pointer' }}>✕</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--surface2)', borderTop: '2px solid var(--border)' }}>
                    <td colSpan={4} style={{ padding: '10px 14px', fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>Total Expenses — FY {fyLabel(fy)}</td>
                    <td style={{ padding: '10px 14px', fontSize: 14, fontWeight: 700, color: 'var(--danger)', textAlign: 'right' }}>{fmtMoney(totals.totalExpenses)}</td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION: BUDGET
      ══════════════════════════════════════════════════════════════════════ */}
      {section === 'budget' && (
        <div>
          <SectionHeader icon="📊" title={`Annual Budget — FY ${fyLabel(fy)}`}
            action={
              <button className="btn-primary" onClick={handleSaveBudgets} disabled={budgetSaving} style={{ fontSize: 13 }}>
                {budgetSaving ? 'Saving…' : 'Save Budget'}
              </button>
            }
          />
          <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 16, marginTop: -8 }}>
            Set annual budget amounts per expense category. Budget resets each financial year (April 1 – March 31).
          </p>

          <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface2)', borderBottom: '2px solid var(--border)' }}>
                  {['Category','Budget (NZD)','Actual Spent','Remaining','% Used','Status'].map((h, i) => (
                    <th key={i} style={{ padding: '10px 16px', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textAlign: i === 0 ? 'left' : 'right' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {EXPENSE_CATEGORIES.map(cat => {
                  const budget  = parseFloat(budgetEdits[cat] ?? (totals.budgetMap[cat] || 0));
                  const spent   = totals.spentMap[cat] || 0;
                  const remaining = budget - spent;
                  const pct = budget > 0 ? Math.round((spent / budget) * 100) : null;
                  const st = budgetStatus(spent, budget);
                  const cfg = BUDGET_STATUS_CFG[st];
                  const catC = EXPENSE_CAT_COLORS[cat] || EXPENSE_CAT_COLORS.Other;
                  return (
                    <tr key={cat} style={{ borderBottom: '1px solid var(--border)', background: st === 'over' ? '#fdf5f5' : 'transparent' }}>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, background: catC.bg, color: catC.color, borderRadius: 20, padding: '2px 9px' }}>{cat}</span>
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                          <span style={{ fontSize: 12, color: 'var(--text3)' }}>$</span>
                          <input
                            type="number" min="0" step="0.01"
                            value={budgetEdits[cat] ?? (totals.budgetMap[cat] || '')}
                            onChange={e => setBudgetEdits(p => ({ ...p, [cat]: e.target.value }))}
                            placeholder="0.00"
                            style={{ width: 100, padding: '4px 8px', fontSize: 13, textAlign: 'right', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)' }}
                          />
                        </div>
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 500, color: 'var(--danger)', textAlign: 'right' }}>{fmtMoney(spent)}</td>
                      <td style={{ padding: '10px 16px', fontSize: 13, textAlign: 'right', color: remaining < 0 ? 'var(--danger)' : 'var(--brand)', fontWeight: remaining < 0 ? 700 : 400 }}>
                        {budget > 0 ? fmtMoney(remaining) : '—'}
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                        {pct !== null && (
                          <div>
                            <div style={{ height: 6, background: 'var(--cream2)', borderRadius: 3, overflow: 'hidden', width: 80, marginLeft: 'auto', marginBottom: 3 }}>
                              <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: st === 'over' ? 'var(--danger)' : st === 'at_risk' ? 'var(--warning)' : 'var(--brand)', borderRadius: 3 }} />
                            </div>
                            <span style={{ fontSize: 11, color: st === 'over' ? 'var(--danger)' : st === 'at_risk' ? 'var(--warning)' : 'var(--brand)', fontWeight: 600 }}>{pct}%</span>
                          </div>
                        )}
                        {pct === null && <span style={{ fontSize: 11, color: 'var(--text3)' }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, borderRadius: 20, padding: '3px 10px' }}>
                          {cfg.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--surface2)', borderTop: '2px solid var(--border)' }}>
                  <td style={{ padding: '10px 16px', fontWeight: 700, fontSize: 12 }}>Total</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, fontSize: 13 }}>
                    {fmtMoney(EXPENSE_CATEGORIES.reduce((s, c) => s + parseFloat(budgetEdits[c] ?? (totals.budgetMap[c] || 0)), 0))}
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, fontSize: 13, color: 'var(--danger)' }}>{fmtMoney(totals.totalExpenses)}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION: BALANCE SHEET
      ══════════════════════════════════════════════════════════════════════ */}
      {section === 'balance-sheet' && (
        <div>
          <SectionHeader icon="⚖️" title="Balance Sheet"
            action={
              <button className="btn-primary" onClick={handleSaveBalanceSheet} disabled={bsSaving} style={{ fontSize: 13 }}>
                {bsSaving ? 'Saving…' : 'Save Balance Sheet'}
              </button>
            }
          />
          {bsSuccess && <div className="alert alert-success" style={{ marginBottom: 16 }}>✓ Balance sheet saved.</div>}
          <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20, marginTop: -8 }}>
            Update cash balance and liabilities manually. Equipment value is pulled automatically from the Assets Register.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
            {/* ASSETS */}
            <div className="panel">
              <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 15, fontWeight: 600, color: 'var(--brand)', marginBottom: 16, paddingBottom: 10, borderBottom: '2px solid var(--brand)' }}>
                Assets
              </div>
              <div className="form-group">
                <label className="form-label">Cash &amp; Bank Balance ($)</label>
                <input type="number" min="0" step="0.01" className="form-input"
                  value={bsForm.cash_balance}
                  onChange={e => setBsForm(f => ({ ...f, cash_balance: e.target.value }))}
                  placeholder="0.00" />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  Equipment Value
                  <span style={{ fontSize: 10, background: '#e8eef8', color: '#1a4a8a', borderRadius: 10, padding: '1px 7px', fontWeight: 600 }}>Auto from Assets</span>
                </label>
                <div style={{ padding: '10px 12px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, fontWeight: 600, color: 'var(--brand)' }}>
                  {fmtMoney(equipmentValue)}
                  <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 400, marginLeft: 8 }}>sum of all asset values in Assets Register</span>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Other Assets ($)</label>
                <input type="number" min="0" step="0.01" className="form-input"
                  value={bsForm.other_assets}
                  onChange={e => setBsForm(f => ({ ...f, other_assets: e.target.value }))}
                  placeholder="0.00" />
              </div>
              <div className="form-group">
                <label className="form-label">Other Assets — Notes</label>
                <input className="form-input" value={bsForm.other_assets_notes}
                  onChange={e => setBsForm(f => ({ ...f, other_assets_notes: e.target.value }))}
                  placeholder="e.g. Furniture, equipment not in Assets Register" />
              </div>

              <div style={{ fontSize: 13, fontWeight: 700, color: '#1a4a8a', marginBottom: 10, marginTop: 4, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                Investments
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
                <thead>
                  <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textAlign: 'left' }}>Description</th>
                    <th style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textAlign: 'right' }}>Amount ($)</th>
                    <th style={{ width: 32 }} />
                  </tr>
                </thead>
                <tbody>
                  {investmentRows.map(row => (
                    <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '5px 6px' }}>
                        <input className="form-input" value={row.name}
                          onChange={e => updateInvestmentRow(row.id, 'name', e.target.value)}
                          placeholder="e.g. ANZ term deposit"
                          style={{ padding: '5px 8px', fontSize: 12 }} />
                      </td>
                      <td style={{ padding: '5px 6px' }}>
                        <input type="number" min="0" step="0.01" className="form-input"
                          value={row.amount}
                          onChange={e => updateInvestmentRow(row.id, 'amount', e.target.value)}
                          placeholder="0.00"
                          style={{ padding: '5px 8px', fontSize: 12, textAlign: 'right' }} />
                      </td>
                      <td style={{ padding: '5px 4px', textAlign: 'center' }}>
                        <button onClick={() => removeInvestmentRow(row.id)} disabled={investmentRows.length === 1}
                          style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: 14, cursor: investmentRows.length === 1 ? 'default' : 'pointer', opacity: investmentRows.length === 1 ? 0.3 : 1 }}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--surface2)', borderTop: '2px solid var(--border)' }}>
                    <td style={{ padding: '6px 10px', fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>Total Investments</td>
                    <td style={{ padding: '6px 10px', fontSize: 13, fontWeight: 700, color: '#1a4a8a', textAlign: 'right' }}>{fmtMoney(investmentsTotal)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
              <button onClick={addInvestmentRow}
                style={{ fontSize: 12, color: 'var(--brand)', background: 'none', border: '1px dashed var(--brand)', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', marginBottom: 12, width: '100%' }}>
                + Add Investment
              </button>

              <div style={{ padding: '12px 14px', background: '#e8f4ef', borderRadius: 8, border: '1px solid #a8d8c0' }}>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Total Assets</div>
                <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, fontWeight: 700, color: 'var(--brand)' }}>{fmtMoney(liveTotalAssets)}</div>
              </div>
            </div>

            {/* LIABILITIES */}
            <div className="panel">
              <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 15, fontWeight: 600, color: 'var(--danger)', marginBottom: 16, paddingBottom: 10, borderBottom: '2px solid var(--danger)' }}>
                Liabilities
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--danger)', marginBottom: 10 }}>Loans</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
                <thead>
                  <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textAlign: 'left' }}>Description</th>
                    <th style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textAlign: 'right' }}>Amount ($)</th>
                    <th style={{ width: 32 }} />
                  </tr>
                </thead>
                <tbody>
                  {loanRows.map(row => (
                    <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '5px 6px' }}>
                        <input className="form-input" value={row.name}
                          onChange={e => updateLoanRow(row.id, 'name', e.target.value)}
                          placeholder="e.g. Marae building loan"
                          style={{ padding: '5px 8px', fontSize: 12 }} />
                      </td>
                      <td style={{ padding: '5px 6px' }}>
                        <input type="number" min="0" step="0.01" className="form-input"
                          value={row.amount}
                          onChange={e => updateLoanRow(row.id, 'amount', e.target.value)}
                          placeholder="0.00"
                          style={{ padding: '5px 8px', fontSize: 12, textAlign: 'right' }} />
                      </td>
                      <td style={{ padding: '5px 4px', textAlign: 'center' }}>
                        <button onClick={() => removeLoanRow(row.id)} disabled={loanRows.length === 1}
                          style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: 14, cursor: loanRows.length === 1 ? 'default' : 'pointer', opacity: loanRows.length === 1 ? 0.3 : 1 }}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--surface2)', borderTop: '2px solid var(--border)' }}>
                    <td style={{ padding: '6px 10px', fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>Total Loans</td>
                    <td style={{ padding: '6px 10px', fontSize: 13, fontWeight: 700, color: 'var(--danger)', textAlign: 'right' }}>{fmtMoney(loansTotal)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
              <button onClick={addLoanRow}
                style={{ fontSize: 12, color: 'var(--danger)', background: 'none', border: '1px dashed #f0b8b0', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', marginBottom: 12, width: '100%' }}>
                + Add Loan
              </button>
              <div className="form-group">
                <label className="form-label">Outstanding Payments ($)</label>
                <input type="number" min="0" step="0.01" className="form-input"
                  value={bsForm.outstanding_payments}
                  onChange={e => setBsForm(f => ({ ...f, outstanding_payments: e.target.value }))}
                  placeholder="0.00" />
              </div>
              <div className="form-group">
                <label className="form-label">Outstanding Payments — Notes</label>
                <input className="form-input" value={bsForm.outstanding_notes}
                  onChange={e => setBsForm(f => ({ ...f, outstanding_notes: e.target.value }))}
                  placeholder="e.g. Supplier invoices, rates due" />
              </div>
              <div style={{ padding: '12px 14px', background: '#faeae7', borderRadius: 8, border: '1px solid #f0b8b0' }}>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Total Liabilities</div>
                <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, fontWeight: 700, color: 'var(--danger)' }}>{fmtMoney(liveTotalLiabilities)}</div>
              </div>
            </div>
          </div>

          {/* NET WORTH */}
          <div className="panel" style={{ textAlign: 'center', padding: '24px', background: liveNetWorth >= 0 ? '#e8f4ef' : '#faeae7', border: `1px solid ${liveNetWorth >= 0 ? '#a8d8c0' : '#f0b8b0'}` }}>
            <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 6 }}>Net Worth (Assets minus Liabilities)</div>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 36, fontWeight: 700, color: liveNetWorth >= 0 ? 'var(--brand)' : 'var(--danger)' }}>
              {liveNetWorth < 0 ? '−' : ''}{fmtMoney(Math.abs(liveNetWorth))}
            </div>
            {balanceSheet?.updated_at && (
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>
                Last updated: {new Date(balanceSheet.updated_at).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION: REPORTS
      ══════════════════════════════════════════════════════════════════════ */}
      {section === 'reports' && (
        <div>
          <SectionHeader icon="📋" title="Financial Reports"
            action={
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-secondary" onClick={printGeneralLedger} style={{ fontSize: 13 }}>
                  📒 General Ledger
                </button>
                <button className="btn-primary" onClick={printAGMReport} style={{ fontSize: 13 }}>
                  🖨️ Generate AGM Report
                </button>
              </div>
            }
          />

          {/* ── DATE RANGE SELECTOR ──────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>Period</span>
            <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              {[
                { key: 'this_fy', label: `This Financial Year (FY ${fyLabel(fy)})` },
                { key: 'prev_fy', label: `Previous Financial Year (FY ${fyLabel(fy - 1)})` },
                { key: 'custom',  label: 'Custom Range' },
              ].map((p, i, arr) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setReportPeriod(p.key)}
                  style={{
                    padding: '7px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    background: reportPeriod === p.key ? 'var(--brand)' : 'var(--surface)',
                    color: reportPeriod === p.key ? '#fff' : 'var(--text2)',
                    border: 'none',
                    borderRight: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                    fontFamily: 'DM Sans, sans-serif',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {reportPeriod === 'custom' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="date"
                  value={customFrom}
                  onChange={e => setCustomFrom(e.target.value)}
                  style={{ padding: '6px 10px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, fontFamily: 'DM Sans, sans-serif' }}
                />
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>to</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={e => setCustomTo(e.target.value)}
                  style={{ padding: '6px 10px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, fontFamily: 'DM Sans, sans-serif' }}
                />
              </div>
            )}
            {reportLoading && <span style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic' }}>Loading…</span>}
          </div>

          {/* Period Summary Tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
            {[
              { label: 'Total Income', value: fmtMoney(reportTotals.totalIncome), icon: '💵', bg: '#e8f4ef', color: 'var(--brand)' },
              { label: 'Total Expenses', value: fmtMoney(reportTotals.totalExpenses), icon: '📤', bg: '#faeae7', color: 'var(--danger)' },
              {
                label: reportTotals.net >= 0 ? 'Net Surplus' : 'Net Deficit',
                value: fmtMoney(Math.abs(reportTotals.net)),
                icon: reportTotals.net >= 0 ? '✅' : '⚠️',
                bg: reportTotals.net >= 0 ? '#e8f4ef' : '#faeae7',
                color: reportTotals.net >= 0 ? 'var(--brand)' : 'var(--danger)',
              },
            ].map((t, i) => (
              <div key={i} className="panel" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 22, marginBottom: 8 }}>{t.icon}</div>
                <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, fontWeight: 700, color: t.color }}>{t.value}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>{t.label} · {periodLabel}</div>
              </div>
            ))}
          </div>

          {/* Income by category */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
            <div className="panel">
              <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 15, fontWeight: 600, marginBottom: 14, color: 'var(--brand)' }}>Income by Category</div>
              {INCOME_CATEGORIES.map(cat => {
                const total = rIncome.filter(i => i.category === cat).reduce((s, i) => s + parseFloat(i.amount || 0), 0);
                if (!total) return null;
                const catC = INCOME_CAT_COLORS[cat] || INCOME_CAT_COLORS.Other;
                const pct = reportTotals.totalIncome > 0 ? (total / reportTotals.totalIncome) * 100 : 0;
                return (
                  <div key={cat} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, background: catC.bg, color: catC.color, borderRadius: 20, padding: '1px 8px' }}>{cat}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--brand)' }}>{fmtMoney(total)}</span>
                    </div>
                    <div style={{ height: 5, background: 'var(--cream2)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'var(--brand-light)', borderRadius: 3 }} />
                    </div>
                  </div>
                );
              })}
              {rIncome.length === 0 && <div style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>No income in this period</div>}
            </div>

            <div className="panel">
              <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 15, fontWeight: 600, marginBottom: 14, color: 'var(--danger)' }}>Expenses by Category</div>
              {EXPENSE_CATEGORIES.map(cat => {
                const spent = reportTotals.spentMap[cat] || 0;
                const budget = totals.budgetMap[cat] || 0;
                if (!spent && !budget) return null;
                const st = budgetStatus(spent, budget);
                const cfg = BUDGET_STATUS_CFG[st];
                const catC = EXPENSE_CAT_COLORS[cat] || EXPENSE_CAT_COLORS.Other;
                const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
                return (
                  <div key={cat} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, background: catC.bg, color: catC.color, borderRadius: 20, padding: '1px 8px' }}>{cat}</span>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 600 }}>{fmtMoney(spent)}</span>
                        {budget > 0 && <span style={{ fontSize: 11, color: 'var(--text3)' }}>/ {fmtMoney(budget)}</span>}
                        <span style={{ fontSize: 10, fontWeight: 700, background: cfg.bg, color: cfg.color, borderRadius: 10, padding: '1px 7px' }}>{cfg.label}</span>
                      </div>
                    </div>
                    {budget > 0 && (
                      <div style={{ height: 5, background: 'var(--cream2)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: st === 'over' ? 'var(--danger)' : st === 'at_risk' ? 'var(--warning)' : 'var(--brand-light)', borderRadius: 3 }} />
                      </div>
                    )}
                  </div>
                );
              })}
              {rExpenses.length === 0 && <div style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>No expenses in this period</div>}
            </div>
          </div>

          {/* Balance Sheet snapshot — always current saved values, not period-filtered */}
          <div className="panel">
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 15, fontWeight: 600, marginBottom: 14 }}>Balance Sheet Snapshot</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, textAlign: 'center' }}>
              {[
                { label: 'Total Assets', value: fmtMoney(totalAssets), color: 'var(--brand)', bg: '#e8f4ef' },
                { label: 'Total Liabilities', value: fmtMoney(totalLiabilities), color: 'var(--danger)', bg: '#faeae7' },
                { label: 'Net Worth', value: fmtMoney(Math.abs(netWorth)), color: netWorth >= 0 ? 'var(--brand)' : 'var(--danger)', bg: netWorth >= 0 ? '#e8f4ef' : '#faeae7' },
              ].map((t, i) => (
                <div key={i} style={{ padding: '16px 10px', background: t.bg, borderRadius: 10 }}>
                  <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, fontWeight: 700, color: t.color }}>{t.value}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{t.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: ADD / EDIT INCOME
      ══════════════════════════════════════════════════════════════════════ */}
      {showIncomeModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowIncomeModal(false); }}>
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-title">{editId ? 'Edit Income' : 'Add Income'}</div>
            {formError && <div className="alert alert-error">{formError}</div>}
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Date *</label>
                <input type="date" className="form-input" value={incomeForm.date} onChange={e => setIncomeForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Amount (NZD) *</label>
                <input type="number" min="0" step="0.01" className="form-input" value={incomeForm.amount} onChange={e => setIncomeForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Description *</label>
              <input className="form-input" value={incomeForm.description} onChange={e => setIncomeForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Hall hire — Smith family" />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-input" value={incomeForm.category} onChange={e => setIncomeForm(f => ({ ...f, category: e.target.value }))}>
                  {INCOME_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-input" value={incomeForm.status} onChange={e => setIncomeForm(f => ({ ...f, status: e.target.value }))}>
                  {INCOME_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Reference Number</label>
              <input className="form-input" value={incomeForm.reference} onChange={e => setIncomeForm(f => ({ ...f, reference: e.target.value }))} placeholder="e.g. INV-001" />
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-input" rows={2} value={incomeForm.notes} onChange={e => setIncomeForm(f => ({ ...f, notes: e.target.value }))} style={{ resize: 'vertical' }} />
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowIncomeModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleSaveIncome} disabled={saving}>{saving ? 'Saving…' : editId ? 'Save Changes' : 'Add Income'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: ADD / EDIT EXPENSE
      ══════════════════════════════════════════════════════════════════════ */}
      {showExpenseModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowExpenseModal(false); }}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-title">{editId ? 'Edit Expense' : 'Add Expense'}</div>
            {formError && <div className="alert alert-error">{formError}</div>}
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Date *</label>
                <input type="date" className="form-input" value={expenseForm.date} onChange={e => setExpenseForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Amount (NZD) *</label>
                <input type="number" min="0" step="0.01" className="form-input" value={expenseForm.amount} onChange={e => setExpenseForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Description *</label>
              <input className="form-input" value={expenseForm.description} onChange={e => setExpenseForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Roof repair — Te Hekenga Roofing" />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-input" value={expenseForm.category} onChange={e => setExpenseForm(f => ({ ...f, category: e.target.value }))}>
                  {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-input" value={expenseForm.status} onChange={e => setExpenseForm(f => ({ ...f, status: e.target.value }))}>
                  {EXPENSE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Payee</label>
                <input
                  list="finance-payee-list"
                  className="form-input"
                  value={expenseForm.payee}
                  onChange={e => setExpenseForm(f => ({ ...f, payee: e.target.value }))}
                  placeholder="Search contacts or type a name"
                  autoComplete="off"
                />
                <datalist id="finance-payee-list">
                  {contactNames.map(name => <option key={name} value={name} />)}
                </datalist>
              </div>
              <div className="form-group">
                <label className="form-label">Reference Number</label>
                <input className="form-input" value={expenseForm.reference} onChange={e => setExpenseForm(f => ({ ...f, reference: e.target.value }))} placeholder="e.g. INV-456" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Receipt</label>
              <input type="file" ref={receiptRef} style={{ display: 'none' }} accept=".pdf,.jpg,.jpeg,.png" onChange={e => setReceiptFile(e.target.files[0] || null)} />
              <button type="button" onClick={() => receiptRef.current?.click()} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', color: 'var(--text2)' }}>
                {receiptFile ? `📎 ${receiptFile.name}` : '📎 Choose receipt'}
              </button>
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-input" rows={2} value={expenseForm.notes} onChange={e => setExpenseForm(f => ({ ...f, notes: e.target.value }))} style={{ resize: 'vertical' }} />
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowExpenseModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleSaveExpense} disabled={saving}>{saving ? 'Saving…' : editId ? 'Save Changes' : 'Add Expense'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: SYNC FROM BOOKINGS / GRANTS
      ══════════════════════════════════════════════════════════════════════ */}
      {showSyncModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowSyncModal(false); }}>
          <div className="modal" style={{ maxWidth: 620 }}>
            <div className="modal-title">Re-sync: Bookings &amp; Grants</div>
            <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16, marginTop: -4, lineHeight: 1.5 }}>
              Income records are auto-created when bookings are approved or grants are marked approved. Use this to recover any that were missed.
            </p>
            {syncLoading ? (
              <div className="loading">Loading…</div>
            ) : (
              <>
                {/* Grants */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand)', marginBottom: 10 }}>Approved Grants — not yet in Finance ({syncGrants.length})</div>
                  {syncGrants.length === 0 ? (
                    <div style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>All approved grants are already recorded.</div>
                  ) : syncGrants.map(g => (
                    <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{g.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{g.funder} · {fmtMoney(g.amount)}</div>
                      </div>
                      <button className="btn-primary" onClick={() => handleSyncGrant(g)} style={{ fontSize: 12, padding: '5px 14px' }}>+ Add</button>
                    </div>
                  ))}
                </div>
                {/* Bookings */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand)', marginBottom: 6 }}>Approved Bookings — not yet in Finance ({syncBookings.length})</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10 }}>Enter the hire fee amount for each booking, then click Add.</div>
                  {syncBookings.length === 0 ? (
                    <div style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>All approved bookings are already recorded.</div>
                  ) : syncBookings.map(b => (
                    <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{b.occasion}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{fmt(b.start_date)} · {b.guests} guests</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12, color: 'var(--text3)' }}>$</span>
                        <input type="number" min="0" step="0.01" placeholder="Amount"
                          value={syncAmounts[b.id] || ''}
                          onChange={e => setSyncAmounts(p => ({ ...p, [b.id]: e.target.value }))}
                          style={{ width: 90, padding: '5px 8px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6 }} />
                        <button className="btn-primary" onClick={() => handleSyncBooking(b)}
                          disabled={!syncAmounts[b.id] || !parseFloat(syncAmounts[b.id])}
                          style={{ fontSize: 12, padding: '5px 14px', opacity: !syncAmounts[b.id] || !parseFloat(syncAmounts[b.id]) ? 0.4 : 1 }}>+ Add</button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowSyncModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: DELETE CONFIRM
      ══════════════════════════════════════════════════════════════════════ */}
      {confirmDeleteId && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setConfirmDeleteId(null); }}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-title" style={{ fontSize: 18 }}>Delete Entry?</div>
            <p style={{ color: 'var(--text2)', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>This entry will be permanently deleted and cannot be recovered.</p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
              <button className="btn-danger" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
