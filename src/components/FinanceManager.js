import React, { useState, useEffect, useRef, useMemo } from 'react';
import Papa from 'papaparse';
import { supabase } from '../lib/supabase';
import StatusPill from './StatusPill';
import { ensureTask } from '../lib/taskSync';
import BankReconciliation from './BankReconciliation';
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, expenseCategoryGroup } from '../lib/financeCategories';
import { syncEntryForAmountChange, syncEntryForStatusChange, voidAllEntriesForRow } from '../lib/glPosting';
import { getTrialBalance, getStatementOfPerformance, getStatementOfPosition } from '../lib/glReports';
import { fetchXeroFinancials } from '../lib/xero';
import XeroFinanceSummary from './XeroFinanceSummary';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const INCOME_STATUSES  = ['Confirmed','Pending'];
const EXPENSE_STATUSES = ['Paid','Pending'];

const SECTIONS = [
  { key: 'income',         label: 'Income',              icon: '💵' },
  { key: 'expenses',       label: 'Expenses',             icon: '📤' },
  { key: 'budget',         label: 'Budget',                icon: '📊' },
  { key: 'balance-sheet',  label: 'Balance Sheet',         icon: '⚖️' },
  { key: 'reports',        label: 'Reports',               icon: '📋' },
  { key: 'reconciliation', label: 'Bank Reconciliation',   icon: '🏦' },
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
function fyForDate(d) {
  const dt = new Date(d);
  return dt.getMonth() >= 3 ? dt.getFullYear() : dt.getFullYear() - 1;
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
  reference: '', notes: '', status: 'Confirmed', entity_id: '', gst_amount: '', payer: '',
};
const EMPTY_EXPENSE = {
  date: new Date().toISOString().split('T')[0],
  description: '', amount: '', category: 'Other',
  payee: '', reference: '', notes: '', status: 'Paid', entity_id: '', gst_amount: '',
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
  const [entityFilter, setEntityFilter] = useState('all');
  const [budgets, setBudgets]   = useState([]);
  const [balanceSheet, setBalanceSheet] = useState(null);
  const [equipmentValue, setEquipmentValue] = useState(0);
  const [contactNames, setContactNames] = useState([]);
  const [entities, setEntities] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [xero, setXero] = useState(null); // null = still resolving
  const [gstRegistered, setGstRegistered] = useState(false);
  const [maraeName, setMaraeName] = useState('MaraeHub');
  const [complianceLinksByExpense, setComplianceLinksByExpense] = useState({});

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

  // Balance sheet reconciliation (Step 4) — opening balance for the current FY
  const [openingBalanceRow, setOpeningBalanceRow] = useState(null); // null = not set
  const [openingBalanceInput, setOpeningBalanceInput] = useState('');
  const [openingBalanceSaving, setOpeningBalanceSaving] = useState(false);

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

  useEffect(() => {
    fetchXeroFinancials().then(result => {
      setXero(result);
      if (result.status === 'not_connected') {
        fetchAll();
      } else {
        setLoading(false);
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function refreshXero() {
    const result = await fetchXeroFinancials(true);
    setXero(result);
  }

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
    const [incRes, expRes, budRes, bsRes, assetRes, ctRes, entRes, settRes, obRes, compLinkRes] = await Promise.all([
      supabase.from('finance_income').select('*').gte('date', fyFrom(fy)).lte('date', fyTo(fy)).order('date', { ascending: false }),
      supabase.from('finance_expenses').select('*').gte('date', fyFrom(fy)).lte('date', fyTo(fy)).order('date', { ascending: false }),
      supabase.from('finance_budgets').select('*').eq('financial_year', fy),
      supabase.from('finance_balance_sheet').select('*').limit(1).single(),
      supabase.from('assets').select('value'),
      supabase.from('contacts').select('full_name').order('full_name'),
      supabase.from('entities').select('id, name').order('name'),
      supabase.from('marae_settings').select('gst_registered, marae_name').limit(1).single(),
      supabase.from('finance_opening_balances').select('*').eq('financial_year', fy).maybeSingle(),
      supabase.from('compliance_items').select('id, name, linked_expense_id').not('linked_expense_id', 'is', null),
    ]);
    setIncome(incRes.data || []);
    setExpenses(expRes.data || []);
    setBudgets(budRes.data || []);
    setEntities(entRes.data || []);
    setGstRegistered(settRes.data?.gst_registered === true);
    setMaraeName(settRes.data?.marae_name || 'MaraeHub');
    setOpeningBalanceRow(obRes.data || null);
    const compLinkMap = {};
    (compLinkRes.data || []).forEach(c => { compLinkMap[c.linked_expense_id] = c.name; });
    setComplianceLinksByExpense(compLinkMap);
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
    const matchEntity = row => entityFilter === 'all' || row.entity_id === entityFilter || row.entity_id === null;
    const rInc = (reportIncome !== null ? reportIncome : income).filter(matchEntity);
    const rExp = (reportExpenses !== null ? reportExpenses : expenses).filter(matchEntity);
    const totalIncome   = rInc.reduce((s, i) => s + parseFloat(i.amount || 0), 0);
    const totalExpenses = rExp.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
    const net = totalIncome - totalExpenses;
    const spentMap = {};
    rExp.forEach(e => { spentMap[e.category] = (spentMap[e.category] || 0) + parseFloat(e.amount || 0); });
    return { totalIncome, totalExpenses, net, spentMap };
  }, [reportIncome, reportExpenses, income, expenses, entityFilter]);

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
      status: row.status || 'Confirmed', entity_id: row.entity_id || '',
      gst_amount: row.gst_amount != null ? String(row.gst_amount) : '',
      payer: row.payer || '',
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
      entity_id: incomeForm.entity_id || null,
      gst_amount: incomeForm.gst_amount === '' ? null : parseFloat(incomeForm.gst_amount),
      payer: incomeForm.payer.trim() || null,
    };
    let rowId = editId;
    let error;
    if (editId) {
      ({ error } = await supabase.from('finance_income').update(payload).eq('id', editId));
    } else {
      const res = await supabase.from('finance_income').insert(payload).select('id').single();
      error = res.error; rowId = res.data?.id;
    }
    if (error) { setFormError(error.message); setSaving(false); return; }
    if (rowId) await syncEntryForAmountChange({ ...payload, id: rowId }, 'income');
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
      status: row.status || 'Paid', entity_id: row.entity_id || '',
      gst_amount: row.gst_amount != null ? String(row.gst_amount) : '',
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
      entity_id: expenseForm.entity_id || null,
      receipt_url, receipt_name,
      gst_amount: expenseForm.gst_amount === '' ? null : parseFloat(expenseForm.gst_amount),
    };
    let rowId = editId;
    let error;
    if (editId) {
      ({ error } = await supabase.from('finance_expenses').update(payload).eq('id', editId));
    } else {
      const res = await supabase.from('finance_expenses').insert(payload).select('id').single();
      error = res.error; rowId = res.data?.id;
    }
    if (error) { setFormError(error.message); setSaving(false); return; }
    if (rowId) await syncEntryForAmountChange({ ...payload, id: rowId }, 'expense');
    setSaving(false); setShowExpenseModal(false); fetchAll();
  }

  async function handleDelete() {
    if (!confirmDeleteId || !deleteType) return;
    const sourceTable = deleteType === 'income' ? 'finance_income' : 'finance_expenses';
    await voidAllEntriesForRow(sourceTable, confirmDeleteId, 'Deleted by trustee');
    await supabase.from(sourceTable).delete().eq('id', confirmDeleteId);
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
    const payload = {
      date: today,
      description: `Grant income — ${grant.name} (${grant.funder || 'unknown funder'})`,
      amount: parseFloat(grant.amount || 0),
      category: 'Grant Income',
      status: 'Confirmed',
      source_type: 'grant',
      source_id: grant.id,
    };
    const { data } = await supabase.from('finance_income').insert(payload).select('id').single();
    if (data?.id) await syncEntryForAmountChange({ ...payload, id: data.id }, 'income');
    setSyncGrants(g => g.filter(x => x.id !== grant.id));
    fetchAll();
  }

  async function handleSyncBooking(booking) {
    const amount = parseFloat(syncAmounts[booking.id] || 0);
    if (!amount) return;
    const payload = {
      date: booking.start_date,
      description: `Booking income — ${booking.occasion}`,
      amount,
      category: 'Booking Income',
      status: 'Confirmed',
      source_type: 'booking',
      source_id: booking.id,
    };
    const { data } = await supabase.from('finance_income').insert(payload).select('id').single();
    if (data?.id) await syncEntryForAmountChange({ ...payload, id: data.id }, 'income');
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

  // ── OPENING BALANCE (Step 4 — balance sheet reconciliation) ────────────────

  async function handleSaveOpeningBalance() {
    if (openingBalanceInput === '' || isNaN(parseFloat(openingBalanceInput))) return;
    setOpeningBalanceSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    let setBy = 'Unknown';
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
      setBy = profile?.full_name || user.email || 'Unknown';
    }
    await supabase.from('finance_opening_balances').upsert({
      financial_year: fy,
      opening_balance: parseFloat(openingBalanceInput),
      set_by: setBy,
      set_at: new Date().toISOString(),
    }, { onConflict: 'financial_year' });
    setOpeningBalanceSaving(false);
    setOpeningBalanceInput('');
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
    await syncEntryForStatusChange({ ...row, status: s }, 'income');
    setIncome(prev => prev.map(i => i.id === row.id ? { ...i, status: s } : i));
  }

  async function handleExpenseStatus(row, s) {
    await supabase.from('finance_expenses').update({ status: s }).eq('id', row.id);
    await syncEntryForStatusChange({ ...row, status: s }, 'expense');
    setExpenses(prev => prev.map(e => e.id === row.id ? { ...e, status: e.id === row.id ? s : e.status } : e));
  }

  // ── AGM REPORT ─────────────────────────────────────────────────────────────

  function printAGMReport() {
    const win = window.open('', '_blank');
    const entityName = entityFilter === 'all' ? 'All Entities' : (entities.find(e => e.id === entityFilter)?.name || 'Unknown Entity');
    const scoped = entityFilter !== 'all';
    const agmIncome = filteredIncome;
    const agmExpenses = filteredExpenses;
    const agmTotalIncome = agmIncome.reduce((s, i) => s + parseFloat(i.amount || 0), 0);
    const agmTotalExpenses = agmExpenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
    const agmNet = agmTotalIncome - agmTotalExpenses;
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
      const total = agmIncome.filter(i => i.category === cat).reduce((s, i) => s + parseFloat(i.amount || 0), 0);
      return total > 0 ? `<tr><td>${cat}</td><td style="text-align:right">${fmtMoney(total)}</td></tr>` : '';
    }).join('');

    const agmSpentMap = {};
    agmExpenses.forEach(e => { agmSpentMap[e.category] = (agmSpentMap[e.category] || 0) + parseFloat(e.amount || 0); });

    const expenseRows = EXPENSE_CATEGORIES.map(cat => {
      const spent = agmSpentMap[cat] || 0;
      if (scoped) {
        return spent > 0 ? `<tr><td>${cat}</td><td style="text-align:right">${fmtMoney(spent)}</td></tr>` : '';
      }
      const budget = totals.budgetMap[cat] || 0;
      const status = budgetStatus(spent, budget);
      const colour = status === 'over' ? '#a63020' : status === 'at_risk' ? '#c8902a' : '#2e7d52';
      return `<tr><td>${cat}</td><td style="text-align:right">${fmtMoney(spent)}</td><td style="text-align:right">${budget ? fmtMoney(budget) : '—'}</td><td style="text-align:right;color:${colour}">${budget ? Math.round((spent/budget)*100) + '%' : '—'}</td></tr>`;
    }).join('');

    const expenseHeading = scoped ? 'Expenditure' : 'Expenditure vs Budget';
    const expenseHeaderRow = scoped
      ? '<tr><th>Category</th><th style="text-align:right">Actual</th></tr>'
      : '<tr><th>Category</th><th style="text-align:right">Actual</th><th style="text-align:right">Budget</th><th style="text-align:right">Used</th></tr>';
    const expenseFooterRow = scoped
      ? `<tr style="font-weight:bold;border-top:2px solid #ccc"><td>Total Expenses</td><td style="text-align:right">${fmtMoney(agmTotalExpenses)}</td></tr>`
      : `<tr style="font-weight:bold;border-top:2px solid #ccc"><td>Total Expenses</td><td style="text-align:right">${fmtMoney(agmTotalExpenses)}</td><td></td><td></td></tr>`;

    // ── Capital vs Operating (category-level, not per-transaction — see
    // expenseCategoryGroup's own comment for why) ──
    const capitalTotal = agmExpenses.filter(e => expenseCategoryGroup(e.category) === 'Capital').reduce((s, e) => s + parseFloat(e.amount || 0), 0);
    const uncategorisedTotal = agmExpenses.filter(e => expenseCategoryGroup(e.category) === 'Uncategorised').reduce((s, e) => s + parseFloat(e.amount || 0), 0);
    const operatingTotal = agmTotalExpenses - capitalTotal - uncategorisedTotal;
    const expenseTypeHtml = `
<h2>Expenditure by Type</h2>
<p style="font-size:11px;color:#888;font-style:italic;margin:4px 0 8px">Grouped by category, not by individual transaction — e.g. any Equipment purchase counts as Capital regardless of size.</p>
<table style="max-width:380px">
  <tr><td>Operating</td><td style="text-align:right">${fmtMoney(operatingTotal)}</td></tr>
  <tr><td>Capital</td><td style="text-align:right">${fmtMoney(capitalTotal)}</td></tr>
  ${uncategorisedTotal > 0 ? `<tr><td>Uncategorised</td><td style="text-align:right">${fmtMoney(uncategorisedTotal)}</td></tr>` : ''}
</table>`;

    // ── GST summary (only rendered when this marae is GST-registered) ──
    const gstHtml = (() => {
      if (!gstRegistered) return '';
      const gstCollected = agmIncome.reduce((s, i) => s + (i.gst_amount != null ? parseFloat(i.gst_amount) : 0), 0);
      const gstPaid = agmExpenses.reduce((s, e) => s + (e.gst_amount != null ? parseFloat(e.gst_amount) : 0), 0);
      const missing = [...agmIncome, ...agmExpenses].filter(t => t.gst_amount == null).length;
      const total = agmIncome.length + agmExpenses.length;
      return `
<h2>GST Summary</h2>
<table style="max-width:380px">
  <tr><td>GST Collected (Income)</td><td style="text-align:right">${fmtMoney(gstCollected)}</td></tr>
  <tr><td>GST Paid (Expenses)</td><td style="text-align:right">${fmtMoney(gstPaid)}</td></tr>
  <tr style="font-weight:bold;border-top:1px solid #ccc"><td>Net GST</td><td style="text-align:right">${fmtMoney(gstCollected - gstPaid)}</td></tr>
</table>
${missing > 0 ? `<p style="font-size:12px;color:#a63020;font-style:italic;margin:4px 0 12px">${missing} of ${total} transactions this period have no GST amount recorded — not included above as zero, genuinely missing. Review before using this for a GST return.</p>` : ''}`;
    })();

    const balanceSheetNote = scoped
      ? `<p style="font-size:12px;color:#a63020;font-style:italic;margin:4px 0 12px">Balance sheet reflects the whole organisation (all entities combined) — not tracked per entity.</p>`
      : '';

    win.document.write(`<!DOCTYPE html><html><head><title>AGM Finance Report ${fyLabel(fy)}</title>
<style>body{font-family:Georgia,serif;max-width:800px;margin:40px auto;color:#222;line-height:1.6}h1{font-size:24px;border-bottom:2px solid #1a4a3a;padding-bottom:8px}h2{font-size:16px;margin-top:28px;color:#1a4a3a}table{width:100%;border-collapse:collapse;margin:12px 0}th{text-align:left;padding:6px 8px;background:#f0f0f0;font-size:13px}td{padding:6px 8px;border-bottom:1px solid #eee;font-size:13px}.net{font-size:18px;font-weight:bold;padding:12px 0}.surplus{color:#1a4a3a}.deficit{color:#a63020}</style>
</head><body>
<h1>Finance Report — ${fyLabel(fy)} Financial Year</h1>
<p style="color:#666;font-size:13px">Prepared for Annual General Meeting · ${new Date().toLocaleDateString('en-NZ',{day:'numeric',month:'long',year:'numeric'})}</p>
<p style="color:#666;font-size:13px">Entity: ${entityName}</p>
<h2>Income</h2><table><tr><th>Category</th><th style="text-align:right">Amount</th></tr>${incomeRows}<tr style="font-weight:bold;border-top:2px solid #ccc"><td>Total Income</td><td style="text-align:right">${fmtMoney(agmTotalIncome)}</td></tr></table>
<h2>${expenseHeading}</h2><table>${expenseHeaderRow}${expenseRows}${expenseFooterRow}</table>
${expenseTypeHtml}
<div class="net ${agmNet >= 0 ? 'surplus' : 'deficit'}">${agmNet >= 0 ? 'Net Surplus' : 'Net Deficit'}: ${fmtMoney(Math.abs(agmNet))}</div>
${gstHtml}
<h2>Balance Sheet Snapshot</h2>${balanceSheetNote}<table>
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
    const entityName = entityFilter === 'all' ? 'All Entities' : (entities.find(e => e.id === entityFilter)?.name || 'Unknown Entity');
    const matchEntity = row => entityFilter === 'all' || row.entity_id === entityFilter || row.entity_id === null;
    const rInc = (reportIncome  !== null ? reportIncome  : income).filter(matchEntity);
    const rExp = (reportExpenses !== null ? reportExpenses : expenses).filter(matchEntity);

    const txns = [
      ...rInc.map(r => ({ date: r.date, description: r.description, category: r.category, inc: parseFloat(r.amount || 0), exp: 0, gst: r.gst_amount })),
      ...rExp.map(r => ({ date: r.date, description: r.description, category: r.category, inc: 0, exp: parseFloat(r.amount || 0), gst: r.gst_amount })),
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

    const capitalTotal = rExp.filter(e => expenseCategoryGroup(e.category) === 'Capital').reduce((s, e) => s + parseFloat(e.amount || 0), 0);
    const uncategorisedTotal = rExp.filter(e => expenseCategoryGroup(e.category) === 'Uncategorised').reduce((s, e) => s + parseFloat(e.amount || 0), 0);
    const operatingTotal = rTotExp - capitalTotal - uncategorisedTotal;

    const gstSummaryHtml = (() => {
      if (!gstRegistered) return '';
      const gstCollected = rInc.reduce((s, i) => s + (i.gst_amount != null ? parseFloat(i.gst_amount) : 0), 0);
      const gstPaid = rExp.reduce((s, e) => s + (e.gst_amount != null ? parseFloat(e.gst_amount) : 0), 0);
      const missing = [...rInc, ...rExp].filter(t => t.gst_amount == null).length;
      const total = rInc.length + rExp.length;
      return `
<h2>GST Summary</h2>
<table style="max-width:380px">
  <tr><td>GST Collected (Income)</td><td style="text-align:right">${fmtMoney(gstCollected)}</td></tr>
  <tr><td>GST Paid (Expenses)</td><td style="text-align:right">${fmtMoney(gstPaid)}</td></tr>
  <tr style="font-weight:bold;border-top:1px solid #ccc"><td>Net GST</td><td style="text-align:right">${fmtMoney(gstCollected - gstPaid)}</td></tr>
</table>
${missing > 0 ? `<p style="font-size:12px;color:#a63020;font-style:italic;margin:4px 0 12px">${missing} of ${total} transactions this period have no GST amount recorded — not included above as zero, genuinely missing. Review before using this for a GST return.</p>` : ''}`;
    })();

    const glLabel = reportPeriod === 'this_fy'
      ? `FY ${fyLabel(fy)}`
      : reportPeriod === 'prev_fy'
      ? `FY ${fyLabel(fy - 1)}`
      : (customFrom && customTo ? `${fmt(customFrom)} to ${fmt(customTo)}` : 'Custom Range');

    const gstColHtml = r => gstRegistered
      ? `<td style="text-align:right;color:${r.gst == null ? '#bbb' : '#666'}">${r.gst == null ? '—' : fmtMoney(parseFloat(r.gst))}</td>`
      : '';

    const rowsHtml = ledgerRows.map(r => `
      <tr>
        <td style="white-space:nowrap">${fmt(r.date)}</td>
        <td>${r.description || '—'}</td>
        <td>${r.category}</td>
        ${gstColHtml(r)}
        <td style="text-align:right;color:#1a4a3a">${r.inc > 0 ? fmtMoney(r.inc) : ''}</td>
        <td style="text-align:right;color:#a63020">${r.exp > 0 ? fmtMoney(r.exp) : ''}</td>
        <td style="text-align:right;font-weight:600;color:${r.balance >= 0 ? '#1a4a3a' : '#a63020'}">${fmtMoney(r.balance)}</td>
      </tr>`).join('');

    const balanceRowColspan = gstRegistered ? 6 : 5;
    const gstHeaderCol = gstRegistered ? '<th style="text-align:right;width:90px">GST</th>' : '';

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
<p style="color:#666;font-size:13px">Entity: ${entityName}</p>
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
      ${gstHeaderCol}
      <th style="text-align:right;width:100px">Income</th>
      <th style="text-align:right;width:100px">Expense</th>
      <th style="text-align:right;width:120px">Running Balance</th>
    </tr>
  </thead>
  <tbody>
    <tr class="balance-row"><td colspan="${balanceRowColspan}">Opening Balance</td><td style="text-align:right">${fmtMoney(openingBalance)}</td></tr>
    ${rowsHtml}
    <tr class="balance-row"><td colspan="${balanceRowColspan}">Closing Balance</td><td style="text-align:right;color:${closingBalance >= 0 ? '#1a4a3a' : '#a63020'}">${fmtMoney(closingBalance)}</td></tr>
  </tbody>
</table>
<h2>Period Summary</h2>
<table style="max-width:380px">
  <tr><td>Total Income</td><td style="text-align:right;color:#1a4a3a;font-weight:600">${fmtMoney(rTotInc)}</td></tr>
  <tr><td>Total Expenses</td><td style="text-align:right;color:#a63020;font-weight:600">${fmtMoney(rTotExp)}</td></tr>
  <tr style="font-weight:bold;border-top:2px solid #ccc"><td>${rNet >= 0 ? 'Net Surplus' : 'Net Deficit'}</td><td style="text-align:right;color:${rNet >= 0 ? '#1a4a3a' : '#a63020'}">${fmtMoney(Math.abs(rNet))}</td></tr>
</table>
<h2>Expenditure by Type</h2>
<p style="font-size:11px;color:#888;font-style:italic;margin:4px 0 8px">Grouped by category, not by individual transaction — e.g. any Equipment purchase counts as Capital regardless of size.</p>
<table style="max-width:380px">
  <tr><td>Operating</td><td style="text-align:right">${fmtMoney(operatingTotal)}</td></tr>
  <tr><td>Capital</td><td style="text-align:right">${fmtMoney(capitalTotal)}</td></tr>
  ${uncategorisedTotal > 0 ? `<tr><td>Uncategorised</td><td style="text-align:right">${fmtMoney(uncategorisedTotal)}</td></tr>` : ''}
</table>
${gstSummaryHtml}
<p style="font-size:11px;color:#999;margin-top:32px">Generated by MaraeHub · maraehub.com</p>
</body></html>`);
    win.document.close();
    win.print();
  }

  // ── ACCOUNTANT EXPORT (CSV, Reports tab only) ──────────────────────────────
  // Deliberately a different shape to the two print reports above: pure
  // transaction rows, no summary cards, no running balance -- a summary row
  // mixed into transaction data would break a clean import into Xero/MYOB/
  // Excel. Reuses the same period-filtered, entity-filtered dataset
  // printGeneralLedger() already uses (reportIncome/reportExpenses), not
  // printAGMReport()'s always-current-FY one (logged separately as a real,
  // pre-existing bug -- deliberately not fixed here).

  function exportAccountantCSV() {
    const matchEntity = row => entityFilter === 'all' || row.entity_id === entityFilter || row.entity_id === null;
    const eInc = (reportIncome  !== null ? reportIncome  : income).filter(matchEntity);
    const eExp = (reportExpenses !== null ? reportExpenses : expenses).filter(matchEntity);
    const entityName = id => id ? (entities.find(e => e.id === id)?.name || 'Unknown') : 'Shared';

    const rows = [
      ...eInc.map(r => ({
        Date: r.date, Type: 'Income', Category: r.category, Group: 'Revenue',
        Description: r.description || '', 'Payee/Payer': r.payer || '', Reference: r.reference || '',
        Status: r.status || '', ...(entities.length > 0 ? { Entity: entityName(r.entity_id) } : {}),
        Notes: r.notes || '', 'Amount (NZD)': parseFloat(r.amount || 0).toFixed(2),
        ...(gstRegistered ? {
          'GST Amount (NZD)': r.gst_amount != null ? parseFloat(r.gst_amount).toFixed(2) : '',
          'GST-Exclusive Amount (NZD)': r.gst_amount != null ? (parseFloat(r.amount || 0) - parseFloat(r.gst_amount)).toFixed(2) : '',
          'GST Status': r.gst_amount != null ? 'Recorded' : 'Missing',
        } : {}),
      })),
      ...eExp.map(r => ({
        Date: r.date, Type: 'Expense', Category: r.category, Group: expenseCategoryGroup(r.category),
        Description: r.description || '', 'Payee/Payer': r.payee || '', Reference: r.reference || '',
        Status: r.status || '', ...(entities.length > 0 ? { Entity: entityName(r.entity_id) } : {}),
        Notes: r.notes || '', 'Amount (NZD)': parseFloat(r.amount || 0).toFixed(2),
        ...(gstRegistered ? {
          'GST Amount (NZD)': r.gst_amount != null ? parseFloat(r.gst_amount).toFixed(2) : '',
          'GST-Exclusive Amount (NZD)': r.gst_amount != null ? (parseFloat(r.amount || 0) - parseFloat(r.gst_amount)).toFixed(2) : '',
          'GST Status': r.gst_amount != null ? 'Recorded' : 'Missing',
        } : {}),
      })),
    ].sort((a, b) => (a.Date < b.Date ? -1 : a.Date > b.Date ? 1 : 0));

    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    a.href = url;
    a.download = `${slug(maraeName)}_finance-export_${slug(periodLabel)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ── GL PERIOD HELPERS (Trial Balance / Financial Statements) ──────────────
  // this_fy uses today as the "as of" / period-end date (the FY isn't over
  // yet); prev_fy uses the real FY-end date; custom uses whatever was picked.

  function glPeriodRange() {
    const today = new Date().toISOString().split('T')[0];
    if (reportPeriod === 'prev_fy') return { from: fyFrom(fy - 1), to: fyTo(fy - 1) };
    if (reportPeriod === 'custom' && customFrom && customTo) return { from: customFrom, to: customTo };
    return { from: fyFrom(fy), to: today };
  }

  // ── TRIAL BALANCE (Reports tab only) ────────────────────────────────────

  async function printTrialBalance() {
    let tb;
    try { tb = await getTrialBalance(); } catch (e) { alert('Could not load Trial Balance: ' + e.message); return; }

    const rows = tb.rows.filter(r => r.totalDebit > 0 || r.totalCredit > 0);
    const rowsHtml = rows.map(r => `
      <tr>
        <td>${r.code}</td>
        <td>${r.name}</td>
        <td>${r.account_type}</td>
        <td style="text-align:right">${r.balanceSide === 'Debit' ? fmtMoney(r.balance) : ''}</td>
        <td style="text-align:right">${r.balanceSide === 'Credit' ? fmtMoney(r.balance) : ''}</td>
      </tr>`).join('');

    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><title>Trial Balance</title>
<style>body{font-family:Georgia,serif;max-width:800px;margin:40px auto;color:#222;line-height:1.6}h1{font-size:22px;border-bottom:2px solid #1a4a3a;padding-bottom:8px}table{width:100%;border-collapse:collapse;margin:12px 0;font-size:13px}th{text-align:left;padding:6px 8px;background:#f0f0f0;font-size:12px}td{padding:6px 8px;border-bottom:1px solid #eee}</style>
</head><body>
<h1>Trial Balance</h1>
<p style="color:#666;font-size:13px">As at ${new Date().toLocaleDateString('en-NZ',{day:'numeric',month:'long',year:'numeric'})} · every account with real activity to date</p>
<table>
<tr><th>Code</th><th>Account</th><th>Type</th><th style="text-align:right">Debit</th><th style="text-align:right">Credit</th></tr>
${rowsHtml}
<tr style="font-weight:bold;border-top:2px solid #ccc"><td colspan="3">Total</td><td style="text-align:right">${fmtMoney(tb.grandTotalDebit)}</td><td style="text-align:right">${fmtMoney(tb.grandTotalCredit)}</td></tr>
</table>
<p style="font-size:13px;color:${tb.balanced ? '#1a4a3a' : '#a63020'};font-weight:600">${tb.balanced ? '✅ Balanced — total debits equal total credits.' : '⚠️ Not balanced — this should never happen given the schema-level balance trigger; please report this.'}</p>
${rows.length === 0 ? '<p style="font-size:12px;color:#a63020;font-style:italic">No ledger activity posted yet — this is expected on a new ledger, not an error.</p>' : ''}
<p style="font-size:11px;color:#999;margin-top:32px">Generated by MaraeHub · maraehub.com</p>
</body></html>`);
    win.document.close();
    win.print();
  }

  // ── FINANCIAL STATEMENTS: Position + Performance (Reports tab only) ───────

  async function printFinancialStatements() {
    const { from, to } = glPeriodRange();
    let perf, pos, allTimePerf;
    try {
      [perf, pos, allTimePerf] = await Promise.all([
        getStatementOfPerformance(from, to),
        getStatementOfPosition(to),
        // There's no year-end closing-entry mechanism yet, so Revenue/Expense
        // balances never actually move into Equity. Real accounting software
        // handles this on interim statements with a computed "Current Year
        // Earnings" plug -- all-time net surplus up to `to`, not just the
        // selected display period -- so Assets = Liabilities + Equity
        // genuinely holds for the reader, even though nothing was posted
        // to an Equity account. '2000-01-01' is a safe "since inception"
        // floor; the real ledger has no data before Step 2 shipped.
        getStatementOfPerformance('2000-01-01', to),
      ]);
    } catch (e) { alert('Could not load Financial Statements: ' + e.message); return; }

    const currentYearEarnings = allTimePerf.netSurplus;
    const totalEquityWithEarnings = pos.totalEquity + currentYearEarnings;
    const netAssetsWithEarnings = pos.totalAssets - pos.totalLiabilities;

    const revRows = perf.revenueRows.map(r => `<tr><td>${r.name}</td><td style="text-align:right">${fmtMoney(r.amount)}</td></tr>`).join('');
    const expRows = perf.expenseRows.map(r => `<tr><td>${r.name}</td><td style="text-align:right">${fmtMoney(r.amount)}</td></tr>`).join('');
    const assetRows = pos.assetRows.map(r => `<tr><td>${r.name}</td><td style="text-align:right">${fmtMoney(r.amount)}</td></tr>`).join('');
    const liabRows = pos.liabilityRows.map(r => `<tr><td>${r.name}</td><td style="text-align:right">${fmtMoney(r.amount)}</td></tr>`).join('');
    const equityRows = pos.equityRows.map(r => `<tr><td>${r.name}</td><td style="text-align:right">${fmtMoney(r.amount)}</td></tr>`).join('')
      + (currentYearEarnings !== 0 ? `<tr><td>Current Year Earnings <span style="font-size:11px;color:#888">(not yet closed to Accumulated Funds)</span></td><td style="text-align:right">${fmtMoney(currentYearEarnings)}</td></tr>` : '');
    const noActivity = perf.revenueRows.length === 0 && perf.expenseRows.length === 0 && pos.assetRows.length === 0 && pos.liabilityRows.length === 0 && pos.equityRows.length === 0;

    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><title>Financial Statements — ${periodLabel}</title>
<style>body{font-family:Georgia,serif;max-width:800px;margin:40px auto;color:#222;line-height:1.6}h1{font-size:24px;border-bottom:2px solid #1a4a3a;padding-bottom:8px}h2{font-size:16px;margin-top:28px;color:#1a4a3a}table{width:100%;border-collapse:collapse;margin:12px 0}th{text-align:left;padding:6px 8px;background:#f0f0f0;font-size:13px}td{padding:6px 8px;border-bottom:1px solid #eee;font-size:13px}.net{font-size:18px;font-weight:bold;padding:12px 0}.surplus{color:#1a4a3a}.deficit{color:#a63020}</style>
</head><body>
<h1>Financial Statements — ${periodLabel}</h1>
<p style="color:#666;font-size:13px">Prepared ${new Date().toLocaleDateString('en-NZ',{day:'numeric',month:'long',year:'numeric'})} · from real general ledger postings</p>
${noActivity ? '<p style="font-size:12px;color:#a63020;font-style:italic">No ledger activity posted yet — this is expected on a new ledger, not an error.</p>' : ''}
<h2>Statement of Financial Performance — ${fmt(from)} to ${fmt(to)}</h2>
<table><tr><th>Revenue</th><th style="text-align:right">Amount</th></tr>${revRows}<tr style="font-weight:bold;border-top:2px solid #ccc"><td>Total Revenue</td><td style="text-align:right">${fmtMoney(perf.totalRevenue)}</td></tr></table>
<table><tr><th>Expenses</th><th style="text-align:right">Amount</th></tr>${expRows}<tr style="font-weight:bold;border-top:2px solid #ccc"><td>Total Expenses</td><td style="text-align:right">${fmtMoney(perf.totalExpense)}</td></tr></table>
<div class="net ${perf.netSurplus >= 0 ? 'surplus' : 'deficit'}">${perf.netSurplus >= 0 ? 'Net Surplus' : 'Net Deficit'}: ${fmtMoney(Math.abs(perf.netSurplus))}</div>
<h2>Statement of Financial Position — as at ${fmt(to)}</h2>
<table><tr><th>Assets</th><th style="text-align:right">Amount</th></tr>${assetRows}<tr style="font-weight:bold;border-top:2px solid #ccc"><td>Total Assets</td><td style="text-align:right">${fmtMoney(pos.totalAssets)}</td></tr></table>
<table><tr><th>Liabilities</th><th style="text-align:right">Amount</th></tr>${liabRows}<tr style="font-weight:bold;border-top:2px solid #ccc"><td>Total Liabilities</td><td style="text-align:right">${fmtMoney(pos.totalLiabilities)}</td></tr></table>
<table><tr><th>Equity</th><th style="text-align:right">Amount</th></tr>${equityRows}<tr style="font-weight:bold;border-top:2px solid #ccc"><td>Total Equity</td><td style="text-align:right">${fmtMoney(totalEquityWithEarnings)}</td></tr></table>
<div class="net ${netAssetsWithEarnings >= 0 ? 'surplus' : 'deficit'}">Net Assets: ${fmtMoney(netAssetsWithEarnings)}</div>
<p style="font-size:11px;color:#888;font-style:italic">Net Assets equals Total Equity above — Assets, less Liabilities, equals Accumulated Funds plus Current Year Earnings.</p>
<p style="font-size:11px;color:#999;margin-top:32px">Generated by MaraeHub · maraehub.com · covers the whole organisation (the ledger has no per-entity split)</p>
</body></html>`);
    win.document.close();
    win.print();
  }

  if (loading) return <div className="loading">Loading finance data...</div>;

  if (xero?.status !== 'not_connected') {
    return <XeroFinanceSummary xero={xero} onRefresh={refreshXero} />;
  }

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

  // ── BALANCE SHEET RECONCILIATION (Step 4) ───────────────────────────────────
  // Cash-only: equipment/investments/loans/other assets have no matching
  // transaction ledger to reconcile against. Checked as of the balance
  // sheet's own updated_at date, not "today live" -- comparing a snapshot
  // saved weeks ago against today's running total would flag a false
  // "discrepancy" every day from ordinary new transactions since. Only
  // Confirmed income / Paid expenses count -- Pending hasn't hit the bank.
  let reconciliation = null;
  if (balanceSheet?.updated_at) {
    const bsUpdatedAt = new Date(balanceSheet.updated_at);
    const asOfFY = fyForDate(bsUpdatedAt);
    if (asOfFY !== fy) {
      reconciliation = { state: 'stale', asOfFY };
    } else if (!openingBalanceRow) {
      reconciliation = { state: 'cannot_verify' };
    } else {
      const asOfDateStr = bsUpdatedAt.toISOString().split('T')[0];
      const incomeToDate = income
        .filter(i => i.status === 'Confirmed' && i.date <= asOfDateStr)
        .reduce((s, i) => s + parseFloat(i.amount || 0), 0);
      const expensesToDate = expenses
        .filter(e => e.status === 'Paid' && e.date <= asOfDateStr)
        .reduce((s, e) => s + parseFloat(e.amount || 0), 0);
      const expected = parseFloat(openingBalanceRow.opening_balance || 0) + incomeToDate - expensesToDate;
      const diff = bsCash - expected;
      reconciliation = Math.abs(diff) < 0.01
        ? { state: 'match', expected, actual: bsCash, asOfDateStr }
        : { state: 'mismatch', expected, actual: bsCash, diff, asOfDateStr };
    }
  }

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

  const filteredIncome = income.filter(row => entityFilter === 'all' || row.entity_id === entityFilter || row.entity_id === null);
  const filteredExpenses = expenses.filter(row => entityFilter === 'all' || row.entity_id === entityFilter || row.entity_id === null);

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
            icon="💵" title="Income" count={filteredIncome.length}
            action={
              <div style={{ display: 'flex', gap: 8 }}>
                {entities.length > 0 && (
                  <select className="form-input" style={{ width: 'auto', fontSize: 12, padding: '6px 12px', borderRadius: 20 }} value={entityFilter} onChange={e => setEntityFilter(e.target.value)}>
                    <option value="all">All Entities</option>
                    {entities.map(ent => <option key={ent.id} value={ent.id}>{ent.name}</option>)}
                  </select>
                )}
                <button className="btn-secondary" onClick={openSyncModal} style={{ fontSize: 12, padding: '7px 14px' }}>
                  ↓ Re-sync / Backup
                </button>
                <button className="btn-primary" onClick={openAddIncome} style={{ fontSize: 13 }}>
                  + Add Income
                </button>
              </div>
            }
          />

          {filteredIncome.length === 0 ? (
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
                  {filteredIncome.map(row => {
                    const catC = INCOME_CAT_COLORS[row.category] || INCOME_CAT_COLORS.Other;
                    const entityName = row.entity_id ? entities.find(e => e.id === row.entity_id)?.name : null;
                    return (
                      <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{fmt(row.date)}</td>
                        <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text1)', maxWidth: 260 }}>
                          <div style={{ fontWeight: 500 }}>{row.description}</div>
                          {row.notes && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{row.notes}</div>}
                          {entityName && <div style={{ marginTop: 2 }}><span style={{ fontSize: 11, background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>{entityName}</span></div>}
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
            icon="📤" title="Expenses" count={filteredExpenses.length}
            action={
              <div style={{ display: 'flex', gap: 8 }}>
                {entities.length > 0 && (
                  <select className="form-input" style={{ width: 'auto', fontSize: 12, padding: '6px 12px', borderRadius: 20 }} value={entityFilter} onChange={e => setEntityFilter(e.target.value)}>
                    <option value="all">All Entities</option>
                    {entities.map(ent => <option key={ent.id} value={ent.id}>{ent.name}</option>)}
                  </select>
                )}
                <button className="btn-primary" onClick={openAddExpense} style={{ fontSize: 13 }}>+ Add Expense</button>
              </div>
            }
          />

          {filteredExpenses.length === 0 ? (
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
                  {filteredExpenses.map(row => {
                    const catC = EXPENSE_CAT_COLORS[row.category] || EXPENSE_CAT_COLORS.Other;
                    const entityName = row.entity_id ? entities.find(e => e.id === row.entity_id)?.name : null;
                    return (
                      <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{fmt(row.date)}</td>
                        <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text1)', maxWidth: 200 }}>
                          <div style={{ fontWeight: 500 }}>{row.description}</div>
                          {row.receipt_url && <a href={row.receipt_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: 'var(--brand)' }}>📎 Receipt</a>}
                          {complianceLinksByExpense[row.id] && <div style={{ marginTop: 2 }}><span style={{ fontSize: 11, background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>🆘 Linked: {complianceLinksByExpense[row.id]}</span></div>}
                          {entityName && <div style={{ marginTop: 2 }}><span style={{ fontSize: 11, background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>{entityName}</span></div>}
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

          {reconciliation?.state === 'match' && (
            <div style={{ padding: '12px 14px', background: '#e8f4ef', border: '1px solid #a8d8c0', borderRadius: 8, marginBottom: 20, fontSize: 13, color: '#1a4a3a' }}>
              ✅ Cash balance ties out — verified as of {fmt(reconciliation.asOfDateStr)}. Opening balance + confirmed income − paid expenses = {fmtMoney(reconciliation.expected)}.
            </div>
          )}
          {reconciliation?.state === 'mismatch' && (
            <div style={{ padding: '12px 14px', background: '#faeae7', border: '1px solid #f0b8b0', borderRadius: 8, marginBottom: 20, fontSize: 13, color: '#a63020' }}>
              ⚠️ Cash balance does not tie out as of {fmt(reconciliation.asOfDateStr)} — off by {fmtMoney(Math.abs(reconciliation.diff))}. Expected {fmtMoney(reconciliation.expected)} (opening balance + confirmed income − paid expenses), balance sheet shows {fmtMoney(reconciliation.actual)}.
            </div>
          )}
          {reconciliation?.state === 'stale' && (
            <div style={{ padding: '12px 14px', background: '#fdf0dc', border: '1px solid #e8c880', borderRadius: 8, marginBottom: 20, fontSize: 13, color: '#7a4f00' }}>
              ℹ️ This balance sheet was last updated in FY {fyLabel(reconciliation.asOfFY)} — reconciliation only checks the current financial year (FY {fyLabel(fy)}). Consider updating it.
            </div>
          )}
          {reconciliation?.state === 'cannot_verify' && (
            <div style={{ padding: '12px 14px', background: '#fdf0dc', border: '1px solid #e8c880', borderRadius: 8, marginBottom: 20, fontSize: 13, color: '#7a4f00' }}>
              <div style={{ marginBottom: 10 }}>ℹ️ Cannot verify — no opening balance set for FY {fyLabel(fy)}, so cash balance can't be checked against income and expenses.</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="number" step="0.01" className="form-input" style={{ maxWidth: 160 }} value={openingBalanceInput}
                  onChange={e => setOpeningBalanceInput(e.target.value)} placeholder="Opening balance ($)" />
                <button className="btn-secondary" style={{ fontSize: 12 }} onClick={handleSaveOpeningBalance} disabled={openingBalanceSaving || openingBalanceInput === ''}>
                  {openingBalanceSaving ? 'Saving…' : 'Set Opening Balance'}
                </button>
              </div>
            </div>
          )}

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
                {entities.length > 0 && (
                  <select className="form-input" style={{ width: 'auto', fontSize: 12, padding: '6px 12px', borderRadius: 20 }} value={entityFilter} onChange={e => setEntityFilter(e.target.value)}>
                    <option value="all">All Entities</option>
                    {entities.map(ent => <option key={ent.id} value={ent.id}>{ent.name}</option>)}
                  </select>
                )}
                <button className="btn-secondary" onClick={printGeneralLedger} style={{ fontSize: 13 }}>
                  📒 General Ledger
                </button>
                <button className="btn-secondary" onClick={exportAccountantCSV} style={{ fontSize: 13 }}>
                  ⬇️ Export for Accountant (CSV)
                </button>
                <button className="btn-secondary" onClick={printTrialBalance} style={{ fontSize: 13 }}>
                  ⚖️ Trial Balance
                </button>
                <button className="btn-secondary" onClick={printFinancialStatements} style={{ fontSize: 13 }}>
                  📑 Financial Statements
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
          SECTION: BANK RECONCILIATION
      ══════════════════════════════════════════════════════════════════════ */}
      {section === 'reconciliation' && <BankReconciliation />}

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
            {gstRegistered && (
              <div className="form-group">
                <label className="form-label">GST Amount (NZD)</label>
                <input type="number" min="0" step="0.01" max={incomeForm.amount || undefined} className="form-input" value={incomeForm.gst_amount} onChange={e => setIncomeForm(f => ({ ...f, gst_amount: e.target.value }))} placeholder="Included in the amount above" />
              </div>
            )}
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
            {entities.length > 0 && (
              <div className="form-group">
                <label className="form-label">Entity</label>
                <select className="form-input" value={incomeForm.entity_id} onChange={e => setIncomeForm(f => ({ ...f, entity_id: e.target.value }))}>
                  <option value="">— Shared (all entities) —</option>
                  {entities.map(ent => <option key={ent.id} value={ent.id}>{ent.name}</option>)}
                </select>
              </div>
            )}
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Payer</label>
                <input
                  list="finance-payer-list"
                  className="form-input"
                  value={incomeForm.payer}
                  onChange={e => setIncomeForm(f => ({ ...f, payer: e.target.value }))}
                  placeholder="Search contacts or type a name"
                  autoComplete="off"
                />
                <datalist id="finance-payer-list">
                  {contactNames.map(name => <option key={name} value={name} />)}
                </datalist>
              </div>
              <div className="form-group">
                <label className="form-label">Reference Number</label>
                <input className="form-input" value={incomeForm.reference} onChange={e => setIncomeForm(f => ({ ...f, reference: e.target.value }))} placeholder="e.g. INV-001" />
              </div>
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
            {gstRegistered && (
              <div className="form-group">
                <label className="form-label">GST Amount (NZD)</label>
                <input type="number" min="0" step="0.01" max={expenseForm.amount || undefined} className="form-input" value={expenseForm.gst_amount} onChange={e => setExpenseForm(f => ({ ...f, gst_amount: e.target.value }))} placeholder="Included in the amount above" />
              </div>
            )}
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
            {entities.length > 0 && (
              <div className="form-group">
                <label className="form-label">Entity</label>
                <select className="form-input" value={expenseForm.entity_id} onChange={e => setExpenseForm(f => ({ ...f, entity_id: e.target.value }))}>
                  <option value="">— Shared (all entities) —</option>
                  {entities.map(ent => <option key={ent.id} value={ent.id}>{ent.name}</option>)}
                </select>
              </div>
            )}
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
