// MaraeHub Grants Tracker
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import StatusPill from './StatusPill';
import { ensureTask } from '../lib/taskSync';
import useProfiles from '../lib/useProfiles';
import { syncEntryForAmountChange } from '../lib/glPosting';
import { matchGrantToGoals } from '../lib/grantMatching';
import { renderReportText } from '../lib/renderReportText';
import { getUrgencyStatus, compareByUrgency } from '../lib/urgencyStatus';
import { useSortPreference } from '../lib/useSortPreference';
import SortSelect from './SortSelect';

const GRANT_URGENCY_OPTS = { dateField: 'deadline', dueSoonDays: 14, doneStatuses: ['approved', 'declined'] };

// Consistent Sort (14yhc7kpea4) Step 4, Part 2. Grants has no
// priority/rating field, so it gets a reduced 3-option set.
const GRANT_SORT_OPTIONS = [
  { value: 'urgency', label: 'Urgency' },
  { value: 'due_date', label: 'Deadline' },
  { value: 'alpha', label: 'A–Z' },
];

function compareGrantsByMode(mode) {
  return (a, b) => {
    if (mode === 'alpha') return (a.name || '').localeCompare(b.name || '');
    if (mode === 'due_date') {
      if (a.deadline && b.deadline) return new Date(a.deadline) - new Date(b.deadline);
      if (a.deadline) return -1;
      if (b.deadline) return 1;
      return compareByUrgency(a, b, GRANT_URGENCY_OPTS);
    }
    return compareByUrgency(a, b, GRANT_URGENCY_OPTS);
  };
}

const STATUSES = ['researching', 'in-progress', 'submitted', 'approved', 'declined', 'reporting'];
const CATEGORIES = ['Community', 'Cultural', 'Education', 'Environment', 'Health', 'Infrastructure', 'Sport & Recreation', 'Other'];

const EMPTY_FORM = {
  name: '', funder: '', amount: '', category: 'Community', status: 'researching',
  deadline: '', submitted_date: '', decision_date: '', reporting_date: '',
  contact_name: '', contact_email: '', owner: '', notes: '', source_url: '',
};

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtMoney(n) {
  if (!n) return '$0';
  return '$' + Number(n).toLocaleString('en-NZ');
}

function daysUntil(d) {
  if (!d) return null;
  const diff = new Date(d) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function GrantsTracker() {
  const allProfiles = useProfiles();
  const trustees = allProfiles.filter(p => p.role === 'trustee');
  const [grants, setGrants] = useState([]);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [maraeSettings, setMaraeSettings] = useState(null);
  const [sortMode, setSortMode] = useSortPreference('grants', 'urgency');

  // AI Grant Drafting (14yhc7kpjbd, Step 7). draftGoalId is the trustee's
  // explicit confirmation of which goal an application is for -- per the
  // Step 6 design, a grantMatching.js match (especially Tier 3/4) is a
  // suggestion, not authorization to draft from. Reset whenever a different
  // grant card is expanded so a stale selection can't carry across grants.
  const [draftGoalId, setDraftGoalId] = useState('');
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftError, setDraftError] = useState('');
  const [draftText, setDraftText] = useState('');
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [draftCopied, setDraftCopied] = useState(false);

  useEffect(() => { fetchGrants(); fetchGoals(); fetchMaraeSettings(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setGrants(prev => [...prev].sort(compareGrantsByMode(sortMode))); }, [sortMode]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchGrants() {
    setLoading(true);
    const { data } = await supabase.from('grants').select('*').order('created_at', { ascending: false });
    const rows = data || [];
    rows.sort(compareGrantsByMode(sortMode));
    setGrants(rows);
    setLoading(false);
    createUrgentTasks(rows);
  }

  // Step 4/5 (14yhc7kpjbd) -- fetched once for grantMatching.js's
  // matchGrantToGoals(), not refetched per grant.
  async function fetchGoals() {
    const { data } = await supabase.from('goals').select('id, name, description, status, focus_area, related_module, target_date');
    setGoals(data || []);
  }

  async function fetchMaraeSettings() {
    const { data } = await supabase.from('marae_settings').select('marae_name, location, iwi, hapu').maybeSingle();
    setMaraeSettings(data || null);
  }

  // Step 6 design: never invent a fact -- every field below is either a real
  // recorded value or an explicit "not recorded" string, so the AI has no
  // reason to guess. Deliberately excludes finance/asset figures for now --
  // GrantsTracker.js doesn't fetch those tables, and Step 6's own real-data
  // investigation found them sparse-to-empty on both live projects anyway;
  // the explicit "none included" line tells the AI to placeholder that
  // section rather than silently omit or fabricate it.
  function buildGrantDraftContext(grant, goal) {
    return [
      `MARAE: ${maraeSettings?.marae_name || 'not recorded'}`,
      `LOCATION: ${maraeSettings?.location || 'not recorded'}`,
      (maraeSettings?.iwi || maraeSettings?.hapu) ? `IWI/HAPŪ: ${[maraeSettings?.iwi, maraeSettings?.hapu].filter(Boolean).join(' / ')}` : `IWI/HAPŪ: not recorded`,
      '',
      'GRANT:',
      `- Name: ${grant.name}`,
      `- Funder: ${grant.funder}`,
      `- Amount requested: ${grant.amount ? fmtMoney(grant.amount) : 'not recorded'}`,
      `- Category: ${grant.category || 'not recorded'}`,
      `- Deadline: ${grant.deadline ? fmt(grant.deadline) : 'not recorded'}`,
      `- What this grant funds / eligibility notes (trustee-entered): ${grant.notes || 'not recorded — trustee has not entered this yet'}`,
      '',
      'GOAL / PROJECT THIS APPLICATION IS FOR (explicitly confirmed by a trustee, not an automatic match):',
      `- Name: ${goal.name}`,
      `- Description: ${goal.description || 'not recorded — trustee has not entered this yet'}`,
      `- Focus area: ${goal.focus_area || 'not recorded'}`,
      `- Target date: ${goal.target_date ? fmt(goal.target_date) : 'not recorded'}`,
      '',
      'SUPPORTING FINANCIAL OR ASSET DATA: none included in this draft. Do not infer or invent any -- use a bracketed placeholder for any section that would normally cite financial position or asset details.',
    ].join('\n');
  }

  async function generateGrantDraft(grant) {
    const goal = goals.find(x => x.id === draftGoalId);
    if (!goal) return;
    setDraftLoading(true);
    setDraftError('');
    setDraftText('');
    const context = buildGrantDraftContext(grant, goal);
    const { data, error } = await supabase.functions.invoke('generate-grant-draft', {
      body: { maraeName: maraeSettings?.marae_name || 'this marae', context },
    });
    setDraftLoading(false);
    if (error) { setDraftError(error.message || 'Could not reach AI service'); return; }
    setDraftText(data?.draft || '');
    setShowDraftModal(true);
  }

  function copyDraft() {
    navigator.clipboard.writeText(draftText).then(() => {
      setDraftCopied(true);
      setTimeout(() => setDraftCopied(false), 2000);
    });
  }

  async function createUrgentTasks(rows) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const urgent = rows.filter(g => getUrgencyStatus(g, GRANT_URGENCY_OPTS) === 'due_soon');
    for (const g of urgent) {
      const daysLeft = Math.ceil((new Date(g.deadline) - today) / 86400000);
      await ensureTask({
        title: `GRANT: ${g.name}`,
        description: `Grant deadline in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. Funder: ${g.funder || 'unknown'}. Status: ${g.status}. Action required. [source_id:${g.id}]`,
        assigned_to: null,
        due_date: g.deadline,
        priority: 'High',
      });
    }
  }

  function openAdd() {
    setForm(EMPTY_FORM);
    setEditId(null);
    setError('');
    setSuccess('');
    setShowForm(true);
    setExpandedId(null);
  }

  function openEdit(g) {
    setForm({
      name: g.name || '',
      funder: g.funder || '',
      amount: g.amount || '',
      category: g.category || 'Community',
      status: g.status || 'researching',
      deadline: g.deadline || '',
      submitted_date: g.submitted_date || '',
      decision_date: g.decision_date || '',
      reporting_date: g.reporting_date || '',
      contact_name: g.contact_name || '',
      contact_email: g.contact_email || '',
      owner: g.owner || '',
      notes: g.notes || '',
      source_url: g.source_url || '',
    });
    setEditId(g.id);
    setError('');
    setSuccess('');
    setShowForm(true);
    setExpandedId(null);
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Grant name is required'); return; }
    if (!form.funder.trim()) { setError('Funder is required'); return; }
    setSaving(true);
    setError('');

    const payload = {
      name: form.name.trim(),
      funder: form.funder.trim(),
      amount: form.amount ? parseFloat(form.amount) : null,
      category: form.category,
      status: form.status,
      deadline: form.deadline || null,
      submitted_date: form.submitted_date || null,
      decision_date: form.decision_date || null,
      reporting_date: form.reporting_date || null,
      contact_name: form.contact_name.trim() || null,
      contact_email: form.contact_email.trim() || null,
      owner: form.owner || null,
      notes: form.notes.trim() || null,
      source_url: form.source_url.trim() || null,
    };

    if (editId) {
      const { error } = await supabase.from('grants').update(payload).eq('id', editId);
      if (error) { setError(error.message); setSaving(false); return; }
      setSuccess('Grant updated.');
    } else {
      const { error } = await supabase.from('grants').insert(payload);
      if (error) { setError(error.message); setSaving(false); return; }
      setSuccess(form.name + ' added.');
    }

    setShowForm(false);
    setEditId(null);
    setSaving(false);
    fetchGrants();
  }

  async function handleDelete(id, name) {
    if (!window.confirm('Remove grant "' + name + '"?')) return;
    await supabase.from('grants').delete().eq('id', id);
    fetchGrants();
  }

  async function handleStatusChange(id, newStatus) {
    await supabase.from('grants').update({ status: newStatus }).eq('id', id);
    setGrants(prev => prev.map(g => g.id === id ? { ...g, status: newStatus } : g));
    if (newStatus === 'approved') {
      const grant = grants.find(g => g.id === id);
      if (grant) {
        const { data: existing } = await supabase
          .from('finance_income')
          .select('id')
          .eq('source_type', 'grant')
          .eq('source_id', id)
          .maybeSingle();
        if (!existing) {
          const payload = {
            date: grant.decision_date || new Date().toISOString().split('T')[0],
            description: `Grant income — ${grant.name} (${grant.funder || 'unknown funder'})`,
            amount: parseFloat(grant.amount || 0),
            category: 'Grant Income',
            status: 'Confirmed',
            source_type: 'grant',
            source_id: id,
          };
          const { data } = await supabase.from('finance_income').insert(payload).select('id').single();
          if (data?.id) await syncEntryForAmountChange({ ...payload, id: data.id }, 'income');
        }
      }
    }
  }

  function setField(k, v) {
    setForm(f => ({ ...f, [k]: v }));
  }

  // Summary calculations
  const approvedTotal = grants.filter(g => g.status === 'approved').reduce((sum, g) => sum + (g.amount || 0), 0);
  const pendingTotal = grants.filter(g => ['submitted', 'in-progress', 'researching'].includes(g.status)).reduce((sum, g) => sum + (g.amount || 0), 0);
  const urgentDeadlines = grants.filter(g => getUrgencyStatus(g, GRANT_URGENCY_OPTS) === 'due_soon');

  const filtered = filterStatus === 'all' ? grants : grants.filter(g => g.status === filterStatus);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 22 }}>Grants Tracker</h2>
          <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Track funding applications and outcomes</p>
        </div>
        <button className="btn-primary" onClick={openAdd}>+ Add Grant</button>
      </div>

      {/* SUMMARY TILES */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <div className="panel" style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: '#e8f4ef', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, margin: '0 auto 10px' }}>✅</div>
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, fontWeight: 600, color: 'var(--brand)' }}>{fmtMoney(approvedTotal)}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Approved Funding</div>
        </div>
        <div className="panel" style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: '#e8eef8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, margin: '0 auto 10px' }}>⏳</div>
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, fontWeight: 600, color: 'var(--info)' }}>{fmtMoney(pendingTotal)}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Pending / In Progress</div>
        </div>
        <div className="panel" style={{ textAlign: 'center', cursor: urgentDeadlines.length ? 'pointer' : 'default' }} onClick={() => urgentDeadlines.length && setFilterStatus('all')}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: urgentDeadlines.length ? '#fdf0dc' : '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, margin: '0 auto 10px' }}>🔔</div>
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, fontWeight: 600, color: urgentDeadlines.length ? 'var(--warning)' : 'var(--text3)' }}>{urgentDeadlines.length}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Deadlines in 14 Days</div>
          {urgentDeadlines.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {urgentDeadlines.map(g => {
                const days = daysUntil(g.deadline);
                return (
                  <div key={g.id} style={{ fontSize: 11, color: days <= 7 ? 'var(--danger)' : 'var(--warning)', marginTop: 2 }}>
                    {g.name} — {days === 0 ? 'today' : days + 'd'}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {success && <div className="alert alert-success">{success}</div>}

      {/* ADD / EDIT MODAL */}
      {showForm && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) { setShowForm(false); setEditId(null); } }}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-title">{editId ? 'Edit Grant' : 'Add New Grant'}</div>

            {error && <div className="alert alert-error">{error}</div>}

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Grant Name *</label>
                <input className="form-input" value={form.name} onChange={e => setField('name', e.target.value)} placeholder="e.g. Marae Development Fund" autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Funder *</label>
                <input className="form-input" value={form.funder} onChange={e => setField('funder', e.target.value)} placeholder="e.g. Te Puni Kōkiri" />
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Amount ($)</label>
                <input type="number" className="form-input" value={form.amount} onChange={e => setField('amount', e.target.value)} placeholder="e.g. 50000" />
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-input" value={form.category} onChange={e => setField('category', e.target.value)}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Owner (Responsible Trustee)</label>
              <select className="form-input" value={form.owner} onChange={e => setField('owner', e.target.value)}>
                <option value="">— Select trustee —</option>
                {trustees.map(t => <option key={t.full_name} value={t.full_name}>{t.full_name}</option>)}
              </select>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-input" value={form.status} onChange={e => setField('status', e.target.value)}>
                  {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Deadline</label>
                <input type="date" className="form-input" value={form.deadline} onChange={e => setField('deadline', e.target.value)} />
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Submitted Date</label>
                <input type="date" className="form-input" value={form.submitted_date} onChange={e => setField('submitted_date', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Decision Date</label>
                <input type="date" className="form-input" value={form.decision_date} onChange={e => setField('decision_date', e.target.value)} />
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Reporting Due Date</label>
                <input type="date" className="form-input" value={form.reporting_date} onChange={e => setField('reporting_date', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Contact Name</label>
                <input className="form-input" value={form.contact_name} onChange={e => setField('contact_name', e.target.value)} placeholder="e.g. Jane Smith" />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Contact Email</label>
              <input type="email" className="form-input" value={form.contact_email} onChange={e => setField('contact_email', e.target.value)} placeholder="e.g. jane@funder.org.nz" />
            </div>

            <div className="form-group">
              <label className="form-label">Source Link</label>
              <input type="url" className="form-input" value={form.source_url} onChange={e => setField('source_url', e.target.value)} placeholder="Link to where you found this grant" />
            </div>

            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-input" rows={3} value={form.notes} onChange={e => setField('notes', e.target.value)} placeholder="What does this grant fund? Any eligibility criteria worth noting?" style={{ resize: 'vertical' }} />
            </div>

            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => { setShowForm(false); setEditId(null); }}>Cancel</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : editId ? 'Save Changes' : 'Add Grant'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI GRANT DRAFT MODAL (14yhc7kpjbd, Step 7) */}
      {showDraftModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowDraftModal(false); }}>
          <div className="modal" style={{ maxWidth: 640, maxHeight: '80vh', overflowY: 'auto' }}>
            <div className="modal-title">Grant Application — AI First Draft</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--warning)', background: '#fdf0dc', borderRadius: 6, padding: '8px 10px', marginBottom: 12 }}>
              ⚠ Unverified AI draft — check every fact and fill every bracketed placeholder before use.
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text1)' }}>{renderReportText(draftText)}</div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowDraftModal(false)}>Close</button>
              <button className="btn-primary" onClick={copyDraft}>{draftCopied ? 'Copied!' : 'Copy'}</button>
            </div>
          </div>
        </div>
      )}

      {/* FILTER BAR */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        <SortSelect value={sortMode} onChange={setSortMode} options={GRANT_SORT_OPTIONS} />
        {['all', ...STATUSES].map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            style={{
              fontSize: 11, borderRadius: 20, padding: '4px 12px', cursor: 'pointer', fontWeight: 500,
              background: filterStatus === s ? 'var(--brand)' : 'var(--surface2)',
              color: filterStatus === s ? '#fff' : 'var(--text2)',
              border: filterStatus === s ? '1px solid var(--brand)' : '1px solid var(--border)',
            }}
          >
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            {s !== 'all' && (
              <span style={{ marginLeft: 5, opacity: 0.7 }}>
                {grants.filter(g => g.status === s).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* GRANTS LIST */}
      {loading ? (
        <div className="loading">Loading grants...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="emoji">💰</div>
          <div>{filterStatus === 'all' ? 'No grants yet — add your first one above' : `No grants with status "${filterStatus}"`}</div>
        </div>
      ) : (
        filtered.map(g => {
          const days = daysUntil(g.deadline);
          const isUrgent = days !== null && days >= 0 && days <= 14 && !['approved', 'declined'].includes(g.status);
          const isExpanded = expandedId === g.id;

          return (
            <div
              key={g.id}
              className="panel"
              style={{ marginBottom: 10, borderLeft: isUrgent ? '3px solid var(--warning)' : '3px solid transparent' }}
            >
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                onClick={() => { setExpandedId(isExpanded ? null : g.id); setDraftGoalId(''); }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{g.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                    {g.funder}
                    {g.category && <span> · {g.category}</span>}
                    {g.deadline && (
                      <span style={{ color: isUrgent ? 'var(--warning)' : 'inherit' }}>
                        {' · '}Deadline: {fmt(g.deadline)}
                        {isUrgent && <strong> ({days === 0 ? 'today!' : days + 'd'})</strong>}
                      </span>
                    )}
                  </div>
                </div>
                {g.amount && (
                  <div style={{ fontSize: 15, fontWeight: 600, color: g.status === 'approved' ? 'var(--brand)' : 'var(--text2)' }}>
                    {fmtMoney(g.amount)}
                  </div>
                )}
                <StatusPill
                  status={g.status}
                  options={STATUSES}
                  onStatusChange={s => handleStatusChange(g.id, s)}
                />
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>{isExpanded ? '▲' : '▼'}</span>
              </div>

              {isExpanded && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px 24px', fontSize: 12, marginBottom: 12 }}>
                    {[
                      { label: 'Submitted', val: fmt(g.submitted_date) },
                      { label: 'Decision', val: fmt(g.decision_date) },
                      { label: 'Reporting Due', val: fmt(g.reporting_date) },
                      { label: 'Contact', val: g.contact_name || '—' },
                      { label: 'Email', val: g.contact_email ? <a href={`mailto:${g.contact_email}`} style={{ color: 'var(--brand)' }}>{g.contact_email}</a> : '—' },
                      { label: 'Owner', val: g.owner || '—' },
                      { label: 'Source', val: g.source_url ? <a href={g.source_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand)' }}>View link</a> : '—' },
                    ].map(({ label, val }) => (
                      <div key={label}>
                        <span style={{ color: 'var(--text3)', fontWeight: 500 }}>{label}: </span>
                        <span>{val}</span>
                      </div>
                    ))}
                  </div>
                  {g.notes && (
                    <div style={{ fontSize: 12, color: 'var(--text2)', background: 'var(--surface2)', borderRadius: 6, padding: '8px 10px', marginBottom: 12 }}>
                      {g.notes}
                    </div>
                  )}
                  {matchGrantToGoals(g, goals).map(({ goal, reasons }) => (
                    <div key={goal.id} style={{ fontSize: 12, color: 'var(--text2)', background: 'var(--surface2)', borderRadius: 6, padding: '8px 10px', marginBottom: 8 }}>
                      <span style={{ fontWeight: 600 }}>🎯 Possible match: {goal.name}</span>
                      <div style={{ color: 'var(--text3)', marginTop: 2 }}>{reasons.join(' · ')}</div>
                    </div>
                  ))}

                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Draft an application (AI)</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <select
                        className="form-input"
                        style={{ fontSize: 12, maxWidth: 280 }}
                        value={draftGoalId}
                        onChange={e => setDraftGoalId(e.target.value)}
                      >
                        <option value="">— Select the goal this application is for —</option>
                        {goals.filter(x => x.status !== 'completed').map(x => (
                          <option key={x.id} value={x.id}>{x.name}</option>
                        ))}
                      </select>
                      <button
                        className="btn-secondary"
                        style={{ fontSize: 11 }}
                        disabled={!draftGoalId || draftLoading}
                        onClick={() => generateGrantDraft(g)}
                      >
                        {draftLoading ? 'Drafting…' : 'Draft Application (AI)'}
                      </button>
                    </div>
                    {draftError && <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 6 }}>{draftError}</div>}
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => openEdit(g)}
                      style={{ fontSize: 11, color: 'var(--brand)', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(g.id, g.name)}
                      style={{ fontSize: 11, color: 'var(--danger)', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
