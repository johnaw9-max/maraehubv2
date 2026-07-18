import React, { useState, useEffect, useRef } from 'react';
import Papa from 'papaparse';
import { supabase } from '../lib/supabase';
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES } from '../lib/financeCategories';

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function fmt(d) {
  if (!d) return '—';
  return new Date(d + 'T12:00:00').toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtMoney(n) {
  const abs = Math.abs(n);
  return `$${abs.toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const DATE_FORMATS = [
  { key: 'DD/MM/YYYY', label: 'DD/MM/YYYY — NZ, AU, UK banks' },
  { key: 'MM/DD/YYYY', label: 'MM/DD/YYYY — US banks' },
  { key: 'YYYY-MM-DD', label: 'YYYY-MM-DD — ISO' },
];

const EMPTY_MAPPING = {
  descriptionColumn: '', dateColumn: '', dateFormat: 'DD/MM/YYYY',
  amountMode: 'single', amountColumn: '', debitColumn: '', creditColumn: '',
};

function parseAmount(raw) {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;
  let negative = false;
  if (s.startsWith('(') && s.endsWith(')')) { negative = true; s = s.slice(1, -1); }
  s = s.replace(/[^0-9.-]/g, '');
  if (!s || s === '-') return null;
  const n = parseFloat(s);
  if (isNaN(n)) return null;
  return negative ? -Math.abs(n) : n;
}

function parseDate(raw, format) {
  if (!raw) return null;
  const parts = String(raw).trim().split(/[/-]/).map(p => p.trim());
  if (parts.length !== 3) return null;
  let y, m, d;
  if (format === 'YYYY-MM-DD') { [y, m, d] = parts; }
  else if (format === 'MM/DD/YYYY') { [m, d, y] = parts; }
  else { [d, m, y] = parts; }
  if (y.length === 2) y = String(2000 + parseInt(y, 10));
  const yNum = parseInt(y, 10), mNum = parseInt(m, 10), dNum = parseInt(d, 10);
  if (!yNum || !mNum || !dNum || mNum < 1 || mNum > 12 || dNum < 1 || dNum > 31) return null;
  return `${yNum}-${String(mNum).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`;
}

function mappingUsable(m, headers) {
  if (!m || !m.dateColumn || !m.descriptionColumn) return false;
  if (!headers.includes(m.dateColumn) || !headers.includes(m.descriptionColumn)) return false;
  if (m.amountMode === 'debitCredit') return headers.includes(m.debitColumn) && headers.includes(m.creditColumn);
  return headers.includes(m.amountColumn);
}

// ─── SECTION HEADER (matches FinanceManager.js) ─────────────────────────────

function SectionHeader({ icon, title, count }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <span style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, fontWeight: 600, color: 'var(--brand)' }}>{title}</span>
      {count !== undefined && (
        <span style={{ fontSize: 12, background: 'var(--brand)', color: '#fff', borderRadius: 20, padding: '1px 9px', fontWeight: 600 }}>{count}</span>
      )}
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function BankReconciliation() {
  const fileRef = useRef();

  const [file, setFile] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [rawRows, setRawRows] = useState([]);
  const [parseError, setParseError] = useState('');

  const [settingsId, setSettingsId] = useState(null);
  const [savedMapping, setSavedMapping] = useState(null);

  const [mapping, setMapping] = useState(EMPTY_MAPPING);
  const [mappingConfirmed, setMappingConfirmed] = useState(false);
  const [showConfirmBar, setShowConfirmBar] = useState(false);
  const [mappingMismatch, setMappingMismatch] = useState(false);
  const [mappingError, setMappingError] = useState('');
  const [savingMapping, setSavingMapping] = useState(false);

  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState('');
  const [results, setResults] = useState(null);

  // "Add to Finance" — per-row draft state for the bank-only list, keyed by index
  const [rowDrafts, setRowDrafts] = useState({});
  const [addingKeys, setAddingKeys] = useState(new Set());
  const [justAddedKeys, setJustAddedKeys] = useState(new Set());
  const [removedKeys, setRemovedKeys] = useState(new Set());
  const [rowAddErrors, setRowAddErrors] = useState({});
  const [addedRefs, setAddedRefs] = useState({});

  // Save / resume / history
  const [activeFilename, setActiveFilename] = useState('');
  const [savingReconciliation, setSavingReconciliation] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [savedAt, setSavedAt] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [resumingId, setResumingId] = useState(null);
  const [resumeError, setResumeError] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('marae_settings').select('id, bank_csv_mapping').limit(1).single();
      if (data) {
        setSettingsId(data.id);
        if (data.bank_csv_mapping) setSavedMapping(data.bank_csv_mapping);
      }
    })();
  }, []);

  useEffect(() => { fetchHistory(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchHistory() {
    setHistoryLoading(true);
    const { data } = await supabase
      .from('bank_reconciliations')
      .select('id, filename, statement_start_date, statement_end_date, reconciled_by, reconciled_at, matched_count, added_count, unresolved_count')
      .order('reconciled_at', { ascending: false });
    setHistory(data || []);
    setHistoryLoading(false);
  }

  // A valid saved mapping gets a one-line yes/no confirmation, never a silent
  // pre-fill. Anything else (no saved mapping, or it doesn't fit this file)
  // gets a completely blank form — nothing pre-filled for a trustee to forget
  // to check.
  function handleFile(f) {
    if (!f) return;
    setFile(f);
    setActiveFilename(f.name);
    setParseError('');
    setResults(null);
    setRunError('');
    setMappingConfirmed(false);
    setSaveError(''); setSavedAt(null);
    Papa.parse(f, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const hdrs = res.meta.fields || [];
        setHeaders(hdrs);
        setRawRows(res.data || []);
        if (savedMapping && mappingUsable(savedMapping, hdrs)) {
          setMapping(savedMapping);
          setShowConfirmBar(true);
          setMappingMismatch(false);
        } else {
          setMapping(EMPTY_MAPPING);
          setShowConfirmBar(false);
          setMappingMismatch(!!savedMapping);
        }
      },
      error: (err) => setParseError(err.message || 'Could not read this file.'),
    });
  }

  function acceptSavedMapping() {
    setShowConfirmBar(false);
    setMappingConfirmed(true);
  }

  function rejectSavedMapping() {
    setMapping(EMPTY_MAPPING);
    setShowConfirmBar(false);
  }

  async function handleConfirmMapping() {
    if (!mapping.dateColumn || !mapping.descriptionColumn) { setMappingError('Pick a Date column and a Description column.'); return; }
    if (mapping.amountMode === 'single' && !mapping.amountColumn) { setMappingError('Pick an Amount column.'); return; }
    if (mapping.amountMode === 'debitCredit' && (!mapping.debitColumn || !mapping.creditColumn)) { setMappingError('Pick both a Debit column and a Credit column.'); return; }
    setSavingMapping(true); setMappingError('');
    const payload = { bank_csv_mapping: mapping, updated_at: new Date().toISOString() };
    const { data, error } = settingsId
      ? await supabase.from('marae_settings').update(payload).eq('id', settingsId).select('id').single()
      : await supabase.from('marae_settings').insert(payload).select('id').single();
    if (error) { setMappingError(error.message); setSavingMapping(false); return; }
    if (!settingsId && data) setSettingsId(data.id);
    setSavedMapping(mapping);
    setMappingMismatch(false);
    setMappingConfirmed(true);
    setSavingMapping(false);
  }

  function changeMapping() {
    setMapping(EMPTY_MAPPING);
    setMappingConfirmed(false);
    setShowConfirmBar(false);
    setResults(null);
    setRunError('');
  }

  function normalizeRows() {
    const normalized = [];
    const unparsed = [];
    rawRows.forEach((row, i) => {
      const date = parseDate(row[mapping.dateColumn], mapping.dateFormat);
      let amount;
      if (mapping.amountMode === 'debitCredit') {
        const debit = parseAmount(row[mapping.debitColumn]);
        const credit = parseAmount(row[mapping.creditColumn]);
        amount = (credit ? Math.abs(credit) : 0) - (debit ? Math.abs(debit) : 0);
        if (!debit && !credit) amount = null;
      } else {
        amount = parseAmount(row[mapping.amountColumn]);
      }
      const description = (row[mapping.descriptionColumn] || '').toString().trim();
      if (!date || amount == null || amount === 0) {
        unparsed.push({ rowIndex: i, description, reason: !date ? 'Could not read date' : amount == null ? 'Could not read amount' : 'Zero amount' });
      } else {
        normalized.push({ date, amount, description });
      }
    });
    return { normalized, unparsed };
  }

  async function runReconciliation() {
    if (!mappingConfirmed) return;
    setRunning(true); setRunError(''); setResults(null);
    setRowDrafts({}); setAddingKeys(new Set()); setJustAddedKeys(new Set()); setRemovedKeys(new Set()); setRowAddErrors({});
    setAddedRefs({}); setSaveError(''); setSavedAt(null);
    const { normalized, unparsed } = normalizeRows();
    if (normalized.length === 0) {
      setRunError('No rows could be read with this mapping — check your column and date-format selections.');
      setRunning(false);
      return;
    }
    const sortedDates = normalized.map(r => r.date).sort();
    const minDate = sortedDates[0], maxDate = sortedDates[sortedDates.length - 1];

    const [incRes, expRes] = await Promise.all([
      supabase.from('finance_income').select('*').gte('date', minDate).lte('date', maxDate),
      supabase.from('finance_expenses').select('*').gte('date', minDate).lte('date', maxDate),
    ]);
    if (incRes.error || expRes.error) {
      setRunError((incRes.error || expRes.error).message);
      setRunning(false);
      return;
    }

    const incomePool = (incRes.data || []).map(r => ({ ...r, _claimed: false }));
    const expensePool = (expRes.data || []).map(r => ({ ...r, _claimed: false }));

    const matched = [];
    const bankOnly = [];
    normalized.forEach(txn => {
      const cents = Math.round(Math.abs(txn.amount) * 100);
      const pool = txn.amount > 0 ? incomePool : expensePool;
      const hit = pool.find(r => !r._claimed && r.date === txn.date && Math.round(parseFloat(r.amount || 0) * 100) === cents);
      if (hit) { hit._claimed = true; matched.push({ bank: txn, book: hit }); }
      else bankOnly.push(txn);
    });

    const booksOnly = [
      ...incomePool.filter(r => !r._claimed).map(r => ({ ...r, _kind: 'income' })),
      ...expensePool.filter(r => !r._claimed).map(r => ({ ...r, _kind: 'expense' })),
    ];

    setResults({ matched, bankOnly, booksOnly, unparsed, minDate, maxDate });
    setRunning(false);
  }

  function getDraft(i, t) {
    return rowDrafts[i] || { kind: t.amount >= 0 ? 'income' : 'expense', category: 'Other' };
  }

  function setDraft(i, t, patch) {
    setRowDrafts(prev => ({ ...prev, [i]: { ...getDraft(i, t), ...patch } }));
  }

  async function addBankRowToFinance(i, t) {
    const draft = getDraft(i, t);
    setAddingKeys(prev => new Set(prev).add(i));
    setRowAddErrors(prev => ({ ...prev, [i]: '' }));
    const table = draft.kind === 'income' ? 'finance_income' : 'finance_expenses';
    const payload = {
      date: t.date,
      description: t.description || '(no description)',
      amount: Math.abs(t.amount),
      category: draft.category,
      status: draft.kind === 'income' ? 'Confirmed' : 'Paid',
      notes: 'Added from bank reconciliation',
    };
    const { data, error } = await supabase.from(table).insert(payload).select('id').single();
    setAddingKeys(prev => { const s = new Set(prev); s.delete(i); return s; });
    if (error) {
      setRowAddErrors(prev => ({ ...prev, [i]: error.message }));
      return;
    }
    if (data) setAddedRefs(prev => ({ ...prev, [i]: { table, id: data.id } }));
    setJustAddedKeys(prev => new Set(prev).add(i));
    setTimeout(() => {
      setRemovedKeys(prev => new Set(prev).add(i));
    }, 900);
  }

  async function getCurrentUserName() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 'Unknown';
    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
    return profile?.full_name || user.email || 'Unknown';
  }

  function buildRowsSnapshot() {
    if (!results) return [];
    const rows = [];
    results.matched.forEach(({ bank, book }) => {
      rows.push({
        group: 'matched',
        date: bank.date, amount: bank.amount, description: bank.description,
        bookTable: bank.amount > 0 ? 'finance_income' : 'finance_expenses',
        bookId: book.id,
      });
    });
    results.bankOnly.forEach((t, i) => {
      const added = removedKeys.has(i) || justAddedKeys.has(i);
      const draft = getDraft(i, t);
      rows.push({
        group: 'bank_only',
        date: t.date, amount: t.amount, description: t.description,
        added,
        addedTo: addedRefs[i] || null,
        draft: { kind: draft.kind, category: draft.category },
      });
    });
    results.booksOnly.forEach(r => {
      rows.push({
        group: 'books_only',
        date: r.date, amount: parseFloat(r.amount || 0), description: r.description,
        category: r.category, kind: r._kind, payee: r.payee || null,
      });
    });
    results.unparsed.forEach(u => {
      rows.push({ group: 'unparsed', description: u.description, reason: u.reason });
    });
    return rows;
  }

  async function saveReconciliation() {
    if (!results) return;
    setSavingReconciliation(true); setSaveError('');
    const rows = buildRowsSnapshot();
    const bankOnlyRows = rows.filter(r => r.group === 'bank_only');
    const matchedCount = rows.filter(r => r.group === 'matched').length;
    const addedCount = bankOnlyRows.filter(r => r.added).length;
    const unresolvedCount = bankOnlyRows.filter(r => !r.added).length;
    const reconciledBy = await getCurrentUserName();
    const payload = {
      filename: activeFilename || 'Untitled statement',
      statement_start_date: results.minDate,
      statement_end_date: results.maxDate,
      reconciled_by: reconciledBy,
      reconciled_at: new Date().toISOString(),
      matched_count: matchedCount,
      added_count: addedCount,
      unresolved_count: unresolvedCount,
      rows,
    };
    const { error } = await supabase
      .from('bank_reconciliations')
      .upsert(payload, { onConflict: 'filename,statement_start_date,statement_end_date' });
    setSavingReconciliation(false);
    if (error) { setSaveError(error.message); return; }
    setSavedAt(new Date());
    fetchHistory();
  }

  // `history` only carries the lightweight list columns (no `rows`, which can
  // be sizeable jsonb) — fetch the full record, including `rows`, at the
  // moment it's actually opened rather than bloating every list load.
  async function resumeReconciliation(record) {
    setResumingId(record.id);
    setResumeError('');
    const { data: full, error } = await supabase
      .from('bank_reconciliations')
      .select('*')
      .eq('id', record.id)
      .single();
    setResumingId(null);
    if (error || !full) {
      setResumeError(error?.message || 'Could not load this reconciliation.');
      return;
    }

    const savedRows = full.rows || [];
    const matched = savedRows.filter(r => r.group === 'matched').map(r => ({
      bank: { date: r.date, amount: r.amount, description: r.description },
      book: { id: r.bookId },
    }));
    const bankOnlyRows = savedRows.filter(r => r.group === 'bank_only');
    const bankOnly = bankOnlyRows.map(r => ({ date: r.date, amount: r.amount, description: r.description }));
    const booksOnly = savedRows.filter(r => r.group === 'books_only').map(r => ({
      date: r.date, amount: r.amount, description: r.description, category: r.category, _kind: r.kind, payee: r.payee,
    }));
    const unparsed = savedRows.filter(r => r.group === 'unparsed').map(r => ({ description: r.description, reason: r.reason }));

    const newJustAdded = new Set();
    const newDrafts = {};
    const newRefs = {};
    bankOnlyRows.forEach((r, i) => {
      if (r.added) newJustAdded.add(i);
      if (r.draft) newDrafts[i] = r.draft;
      if (r.addedTo) newRefs[i] = r.addedTo;
    });

    setResults({ matched, bankOnly, booksOnly, unparsed, minDate: full.statement_start_date, maxDate: full.statement_end_date });
    setRemovedKeys(new Set());
    setJustAddedKeys(newJustAdded);
    setRowDrafts(newDrafts);
    setAddedRefs(newRefs);
    setAddingKeys(new Set());
    setRowAddErrors({});
    setActiveFilename(full.filename);
    setRunError('');
    setSaveError('');
    setSavedAt(null);
    setFile(null); setHeaders([]); setRawRows([]); setParseError('');
    setMappingConfirmed(false); setShowConfirmBar(false); setMappingMismatch(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  function reset() {
    setFile(null); setHeaders([]); setRawRows([]); setParseError('');
    setResults(null); setRunError(''); setMappingConfirmed(false); setMappingMismatch(false);
    setShowConfirmBar(false); setMapping(EMPTY_MAPPING);
    setRowDrafts({}); setAddingKeys(new Set()); setJustAddedKeys(new Set()); setRemovedKeys(new Set()); setRowAddErrors({});
    setActiveFilename(''); setAddedRefs({}); setSaveError(''); setSavedAt(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  const exampleRow = rawRows[0];
  const compareDisabled = !mappingConfirmed || running;
  const bankOnlyOutstandingCount = results ? results.bankOnly.filter((t, i) => !removedKeys.has(i) && !justAddedKeys.has(i)).length : 0;
  const bankOnlyVisibleCount = results ? results.bankOnly.filter((t, i) => !removedKeys.has(i)).length : 0;

  // Live preview so picking a non-numeric column (e.g. Payee, Reference) for
  // an amount field is visible immediately, the same safeguard the date
  // format dropdown already has.
  function amountPreview(columnKey, { allowBlank = false } = {}) {
    const col = mapping[columnKey];
    if (!col || !exampleRow) return null;
    const raw = exampleRow[col];
    if (raw == null || String(raw).trim() === '') {
      return allowBlank
        ? <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>Example row is blank for this column — normal for split debit/credit exports.</div>
        : <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 6 }}>Example: (blank) — check this column</div>;
    }
    const parsed = parseAmount(raw);
    return parsed != null
      ? <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>Example: "{raw}" → {fmtMoney(parsed)}</div>
      : <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 6 }}>Example: "{raw}" — doesn't look like a number, check this column</div>;
  }

  return (
    <div>
      <SectionHeader icon="🏦" title="Bank Reconciliation" />

      {/* ── HISTORY ─────────────────────────────────────────────────────── */}
      {!historyLoading && history.length > 0 && (
        <div className="panel" style={{ marginBottom: 20 }}>
          <SectionHeader icon="🕓" title="Past Reconciliations" count={history.length} />
          {resumeError && (
            <div style={{ background: '#faeae7', border: '1px solid #f0b8b0', borderRadius: 8, padding: '10px 14px', color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{resumeError}</div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {history.map(h => (
              <div
                key={h.id}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--surface2)', borderRadius: 7, gap: 12 }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text1)' }}>{h.filename} — {fmt(h.statement_start_date)} to {fmt(h.statement_end_date)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                    Last saved {new Date(h.reconciled_at).toLocaleString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} by {h.reconciled_by || 'Unknown'}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <span style={{ fontSize: 10, background: '#e8f4ef', color: '#1a4a3a', borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>{h.matched_count} matched</span>
                  <span style={{ fontSize: 10, background: '#e8f4ef', color: '#1a4a3a', borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>{h.added_count} added</span>
                  {h.unresolved_count > 0 && (
                    <span style={{ fontSize: 10, background: '#faeae7', color: 'var(--danger)', borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>{h.unresolved_count} pending</span>
                  )}
                  <button
                    type="button"
                    onClick={() => resumeReconciliation(h)}
                    disabled={resumingId === h.id}
                    className="btn-secondary"
                    style={{ marginLeft: 6, fontSize: 12, padding: '5px 12px', cursor: resumingId === h.id ? 'not-allowed' : 'pointer' }}
                  >
                    {resumingId === h.id ? 'Opening…' : '✏️ Edit'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── UPLOAD ──────────────────────────────────────────────────────── */}
      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="form-group" style={{ marginBottom: file ? 16 : 0 }}>
          <label className="form-label">Bank statement CSV</label>
          <input type="file" ref={fileRef} style={{ display: 'none' }} accept=".csv" onChange={e => handleFile(e.target.files[0] || null)} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button type="button" onClick={() => fileRef.current?.click()} className="btn-secondary" style={{ cursor: 'pointer' }}>
              {file ? `📎 ${file.name}` : '📎 Choose CSV file'}
            </button>
            {file && <button type="button" onClick={reset} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>Clear</button>}
          </div>
        </div>
        {parseError && (
          <div style={{ background: '#faeae7', border: '1px solid #f0b8b0', borderRadius: 8, padding: '10px 14px', color: 'var(--danger)', fontSize: 13, marginTop: 12 }}>{parseError}</div>
        )}
        {headers.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Columns found in this file ({rawRows.length} row{rawRows.length !== 1 ? 's' : ''})
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {headers.map(h => (
                <span key={h} style={{ fontSize: 12, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px' }}>{h}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── SAVED MAPPING CONFIRM BAR — one line, yes/no, no fields to check ── */}
      {showConfirmBar && (
        <div className="panel" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ fontSize: 13 }}>
            Using your saved settings: <strong>{mapping.descriptionColumn}</strong>, <strong>{mapping.dateColumn}</strong>, <strong>{mapping.amountMode === 'single' ? mapping.amountColumn : `${mapping.debitColumn} / ${mapping.creditColumn}`}</strong> — looks right?
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button type="button" onClick={acceptSavedMapping} className="btn-primary" style={{ cursor: 'pointer' }}>Yes, use this</button>
            <button type="button" onClick={rejectSavedMapping} className="btn-secondary" style={{ cursor: 'pointer' }}>No, let me choose again</button>
          </div>
        </div>
      )}

      {/* ── MAPPING MISMATCH NOTICE ─────────────────────────────────────── */}
      {headers.length > 0 && mappingMismatch && !mappingConfirmed && !showConfirmBar && (
        <div className="panel" style={{ marginBottom: 20, borderLeft: '4px solid var(--warning)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#7a4f00' }}>Your saved mapping doesn't match this file's columns</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Map the columns below.</div>
        </div>
      )}

      {/* ── CONFIRMED MAPPING SUMMARY ───────────────────────────────────── */}
      {headers.length > 0 && mappingConfirmed && (
        <div className="panel" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 13 }}>
            <span style={{ fontWeight: 600, color: 'var(--brand)' }}>✅ Mapping confirmed</span>
            <span style={{ color: 'var(--text3)' }}> — Date: {mapping.dateColumn} ({mapping.dateFormat}) · Description: {mapping.descriptionColumn} · Amount: {mapping.amountMode === 'single' ? mapping.amountColumn : `${mapping.debitColumn} / ${mapping.creditColumn}`}</span>
          </div>
          <button type="button" onClick={changeMapping} style={{ background: 'none', border: 'none', color: 'var(--brand)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Change mapping</button>
        </div>
      )}

      {/* ── MAPPING FORM — completely blank, shown only when there's no valid saved mapping to confirm ── */}
      {headers.length > 0 && !mappingConfirmed && !showConfirmBar && (
        <div className="panel" style={{ marginBottom: 20 }}>
          <SectionHeader icon="🧭" title="Map your columns" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Description column</label>
              <select className="form-input" value={mapping.descriptionColumn} onChange={e => setMapping(m => ({ ...m, descriptionColumn: e.target.value }))}>
                <option value="">Select column…</option>
                {headers.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Date column</label>
              <select className="form-input" value={mapping.dateColumn} onChange={e => setMapping(m => ({ ...m, dateColumn: e.target.value }))}>
                <option value="">Select column…</option>
                {headers.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Date format</label>
              <select className="form-input" value={mapping.dateFormat} onChange={e => setMapping(m => ({ ...m, dateFormat: e.target.value }))}>
                {DATE_FORMATS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
              </select>
              {mapping.dateColumn && exampleRow && (
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
                  Example: "{exampleRow[mapping.dateColumn]}" → {parseDate(exampleRow[mapping.dateColumn], mapping.dateFormat) ? fmt(parseDate(exampleRow[mapping.dateColumn], mapping.dateFormat)) : 'could not read this — try a different format'}
                </div>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Amount columns</label>
              <select className="form-input" value={mapping.amountMode} onChange={e => {
                const mode = e.target.value;
                setMapping(m => ({
                  ...m,
                  amountMode: mode,
                  amountColumn: mode === 'single' ? m.amountColumn : '',
                  debitColumn: mode === 'debitCredit' ? m.debitColumn : '',
                  creditColumn: mode === 'debitCredit' ? m.creditColumn : '',
                }));
              }}>
                <option value="single">Single Amount column (signed)</option>
                <option value="debitCredit">Separate Debit / Credit columns</option>
              </select>
            </div>
            {mapping.amountMode === 'single' ? (
              <div className="form-group">
                <label className="form-label">Amount column</label>
                <select className="form-input" value={mapping.amountColumn} onChange={e => setMapping(m => ({ ...m, amountColumn: e.target.value }))}>
                  <option value="">Select column…</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                {amountPreview('amountColumn')}
              </div>
            ) : (
              <>
                <div className="form-group">
                  <label className="form-label">Debit column</label>
                  <select className="form-input" value={mapping.debitColumn} onChange={e => setMapping(m => ({ ...m, debitColumn: e.target.value }))}>
                    <option value="">Select column…</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                  {amountPreview('debitColumn', { allowBlank: true })}
                </div>
                <div className="form-group">
                  <label className="form-label">Credit column</label>
                  <select className="form-input" value={mapping.creditColumn} onChange={e => setMapping(m => ({ ...m, creditColumn: e.target.value }))}>
                    <option value="">Select column…</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                  {amountPreview('creditColumn', { allowBlank: true })}
                </div>
              </>
            )}
          </div>
          {mappingError && <div style={{ background: '#faeae7', border: '1px solid #f0b8b0', borderRadius: 8, padding: '10px 14px', color: 'var(--danger)', fontSize: 13, marginTop: 4, marginBottom: 12 }}>{mappingError}</div>}
          <button type="button" onClick={handleConfirmMapping} disabled={savingMapping} className="btn-primary" style={{ cursor: savingMapping ? 'not-allowed' : 'pointer' }}>
            {savingMapping ? 'Confirming…' : '✅ Confirm mapping'}
          </button>
        </div>
      )}

      {/* ── RUN — visually disabled until the mapping for this file has been confirmed ── */}
      {headers.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <button
            type="button"
            onClick={runReconciliation}
            disabled={compareDisabled}
            className={compareDisabled ? '' : 'btn-primary'}
            title={!mappingConfirmed ? 'Confirm the column mapping above first' : undefined}
            style={compareDisabled
              ? { background: 'var(--surface2)', color: 'var(--text3)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'not-allowed', opacity: 0.6 }
              : { cursor: 'pointer' }}
          >
            {running ? 'Comparing…' : '🔍 Compare against Finance records'}
          </button>
        </div>
      )}
      {runError && (
        <div className="panel" style={{ marginBottom: 20, background: '#faeae7', border: '1px solid #f0b8b0' }}>
          <div style={{ color: 'var(--danger)', fontSize: 13 }}>{runError}</div>
        </div>
      )}

      {/* ── RESULTS ─────────────────────────────────────────────────────── */}
      {results && (
        <>
          <div className="panel" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>
              {savedAt
                ? `Saved at ${savedAt.toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit' })}`
                : 'Not yet saved — you can save at any point, finished or not.'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {saveError && <span style={{ fontSize: 12, color: 'var(--danger)' }}>{saveError}</span>}
              <button
                type="button"
                onClick={saveReconciliation}
                disabled={savingReconciliation}
                className="btn-primary"
                style={{ cursor: savingReconciliation ? 'not-allowed' : 'pointer' }}
              >
                {savingReconciliation ? 'Saving…' : '💾 Save Reconciliation'}
              </button>
            </div>
          </div>

          <div className="panel" style={{ marginBottom: 20 }}>
            <SectionHeader icon="✅" title="Matched" count={results.matched.length} />
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>
              {results.matched.length === 0
                ? 'No transactions matched — check the results below.'
                : `${results.matched.length} bank transaction${results.matched.length !== 1 ? 's' : ''} between ${fmt(results.minDate)} and ${fmt(results.maxDate)} matched an existing Finance record.`}
            </div>
          </div>

          <div className="panel" style={{ marginBottom: 20, borderLeft: bankOnlyOutstandingCount > 0 ? '4px solid var(--danger)' : undefined }}>
            <SectionHeader icon="⚠️" title="On the bank statement, not recorded in Finance" count={bankOnlyOutstandingCount} />
            {bankOnlyVisibleCount === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>Every bank transaction in this file is already recorded.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {results.bankOnly.map((t, i) => {
                  if (removedKeys.has(i)) return null;
                  if (justAddedKeys.has(i)) {
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#e8f4ef', borderRadius: 7, borderLeft: '3px solid var(--brand)' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#1a4a3a' }}>✅ Added to Finance — {t.description || '(no description)'}</span>
                      </div>
                    );
                  }
                  const draft = getDraft(i, t);
                  const categories = draft.kind === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
                  const adding = addingKeys.has(i);
                  return (
                    <div key={i} style={{ padding: '10px 12px', background: '#faeae7', borderRadius: 7, borderLeft: '3px solid var(--danger)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text1)' }}>{t.description || '(no description)'}</div>
                          <div style={{ fontSize: 11, color: 'var(--text3)' }}>{fmt(t.date)}</div>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: t.amount >= 0 ? 'var(--brand)' : 'var(--danger)' }}>
                          {t.amount >= 0 ? '+' : '-'}{fmtMoney(t.amount)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                          {['income', 'expense'].map(k => (
                            <button
                              key={k}
                              type="button"
                              onClick={() => setDraft(i, t, { kind: k, category: 'Other' })}
                              style={{
                                padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none',
                                background: draft.kind === k ? 'var(--brand)' : 'var(--surface)',
                                color: draft.kind === k ? '#fff' : 'var(--text2)',
                              }}
                            >
                              {k === 'income' ? 'Income' : 'Expense'}
                            </button>
                          ))}
                        </div>
                        <select
                          className="form-input"
                          style={{ width: 'auto', padding: '5px 10px', fontSize: 12 }}
                          value={draft.category}
                          onChange={e => setDraft(i, t, { category: e.target.value })}
                        >
                          {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <button
                          type="button"
                          onClick={() => addBankRowToFinance(i, t)}
                          disabled={adding}
                          className="btn-primary"
                          style={{ padding: '5px 14px', fontSize: 12, cursor: adding ? 'not-allowed' : 'pointer' }}
                        >
                          {adding ? 'Adding…' : '➕ Add to Finance'}
                        </button>
                      </div>
                      {rowAddErrors[i] && (
                        <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 6 }}>{rowAddErrors[i]}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="panel" style={{ marginBottom: 20, borderLeft: results.booksOnly.length > 0 ? '4px solid var(--warning)' : undefined }}>
            <SectionHeader icon="⚠️" title="In Finance, not on the bank statement" count={results.booksOnly.length} />
            {results.booksOnly.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>Every Finance record in this date range showed up on the bank statement.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {results.booksOnly.map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#fdf0dc', borderRadius: 7, borderLeft: '3px solid var(--warning)', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text1)' }}>{r.description}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{fmt(r.date)} · {r.category}{r._kind === 'expense' && r.payee ? ` · ${r.payee}` : ''}</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: r._kind === 'income' ? 'var(--brand)' : 'var(--danger)' }}>
                      {r._kind === 'income' ? '+' : '-'}{fmtMoney(parseFloat(r.amount || 0))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {results.unparsed.length > 0 && (
            <div className="panel" style={{ marginBottom: 20 }}>
              <SectionHeader icon="❓" title="Rows we couldn't read" count={results.unparsed.length} />
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>These rows in your file were skipped — check the mapping or the raw data for these rows.</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {results.unparsed.map((u, i) => (
                  <div key={i} style={{ fontSize: 12, color: 'var(--text2)' }}>
                    Row {u.rowIndex + 2}: {u.description || '(no description)'} — <span style={{ color: 'var(--danger)' }}>{u.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
