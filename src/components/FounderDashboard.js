import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { supabaseTineka, supabaseWaioweka } from '../lib/supabaseMulti';

const FOUNDER_EMAILS = ['johnaw9@gmail.com', 'waj@maraehub.co.nz'];

const ONBOARDING_STEPS = [
  { key: 'demo_completed',    label: 'Demo completed' },
  { key: 'email_1_sent',      label: 'Email 1 sent' },
  { key: 'week_1_session',    label: 'Week 1 session done' },
  { key: 'email_3_sent',      label: 'Email 3 sent' },
  { key: 'feedback_received', label: 'Feedback received' },
  { key: 'converted',         label: 'Converted to paying' },
];

const GREEN  = '#0F6E56';
const AMBER  = '#BA7517';
const RED    = '#A32D2D';
const CREAM  = '#F5F2EA';
const WHITE  = '#FFFFFF';
const BORDER = '#E0DDD5';
const TEXT1  = '#1A1A18';
const TEXT3  = '#888884';

function Card({ children, style = {} }) {
  return (
    <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '20px 24px', ...style }}>
      {children}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 13, fontWeight: 700, color: TEXT3, textTransform: 'uppercase', letterSpacing: 1, borderBottom: `1px solid ${BORDER}`, paddingBottom: 10, marginBottom: 16 }}>
      {children}
    </div>
  );
}

function StatRow({ label, value, color, bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
      <span style={{ fontSize: 13, color: TEXT3 }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: bold ? 700 : 500, color: color || TEXT1 }}>{value}</span>
    </div>
  );
}

function Pill({ text, color, bg }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color, background: bg, padding: '3px 10px', borderRadius: 20, display: 'inline-block' }}>
      {text}
    </span>
  );
}

function FieldInput({ label, value, onChange, type = 'text', placeholder = '' }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 12, color: TEXT3, display: 'block', marginBottom: 4 }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(type === 'number' ? Number(e.target.value) : e.target.value)}
        placeholder={placeholder}
        style={{ width: '100%', padding: '8px 10px', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, color: TEXT1, background: WHITE, outline: 'none', boxSizing: 'border-box' }}
      />
    </div>
  );
}

const MARAE_PILL = {
  Active:     { color: GREEN,     bg: '#E6F4F0' },
  Trial:      { color: AMBER,     bg: '#FDF3E3' },
  Interested: { color: '#4A6FA5', bg: '#EAF0FA' },
  Cold:       { color: TEXT3,     bg: CREAM },
};

const BLANK_LEAD = { name: '', date: '', reason: '', lesson: '' };

async function fetchEnvKPIs(client, label = '') {
  if (!client) return null;
  const todayStr = new Date().toISOString().split('T')[0];
  const [trusteesRes, compRes, bookRes, assetsRes] = await Promise.all([
    client.rpc('get_trustee_login_activity'),
    client.from('compliance_items').select('id', { count: 'exact', head: true }),
    client.from('bookings').select('id', { count: 'exact', head: true }).gte('start_date', todayStr),
    client.from('assets').select('id', { count: 'exact', head: true }),
  ]);

  let trustees = trusteesRes.data || [];
  if (trusteesRes.error || !trustees.length) {
    const { data: profiles, error: pErr } = await client
      .from('profiles')
      .select('id, full_name, email')
      .order('full_name');
    console.log(`[FounderDashboard] ${label} profiles fallback:`, { data: profiles, error: pErr });
    trustees = profiles || [];
  }

  return {
    trustees,
    compliance: compRes.count || 0,
    bookings:   bookRes.count || 0,
    assets:     assetsRes.count || 0,
  };
}

export default function FounderDashboard({ profile }) {
  const [mrr, setMrr]               = useState(0);
  const [payingMarae, setPayingMarae] = useState(0);
  const [shipped, setShipped]        = useState('');
  const [weekFocus, setWeekFocus]    = useState({ ship: '', contact: '', fix: '' });
  const [saved, setSaved]            = useState(false);
  const [loading, setLoading]        = useState(true);
  const [settingsId, setSettingsId]  = useState(null);

  const [terere,   setTerere]   = useState({ status: 'Active',     note: '' });
  const [tineka,   setTineka]   = useState({ status: 'Trial',      note: '' });
  const [waioweka, setWaioweka] = useState({ status: 'Interested', note: '' });

  const [taskCount,    setTaskCount]    = useState(0);
  const [activeUsers,  setActiveUsers]  = useState(0);
  const [checklist,    setChecklist]    = useState({});
  const [kpiTerere,   setKpiTerere]   = useState(null);
  const [kpiTineka,   setKpiTineka]   = useState(null);
  const [kpiWaioweka, setKpiWaioweka] = useState(null);

  // Custom marae added by founder
  const [customMarae,    setCustomMarae]    = useState([]);
  const [addingMarae,    setAddingMarae]    = useState(false);
  const [newMaraeName,   setNewMaraeName]   = useState('');

  // Lost leads
  const [lostLeads,  setLostLeads]  = useState([]);
  const [addingLead, setAddingLead] = useState(false);
  const [newLead,    setNewLead]    = useState(BLANK_LEAD);

  // Trial dates (localStorage, generic key-value)
  const [trialDates, setTrialDates] = useState(() => {
    const result = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (/_trial_start$|_trial_end$|_goes_live$/.test(k)) result[k] = localStorage.getItem(k);
    }
    return result;
  });

  function setTrialDate(key, value) {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
    setTrialDates(d => ({ ...d, [key]: value }));
  }

  useEffect(() => {
    if (!FOUNDER_EMAILS.includes(profile?.email)) return;
    loadAll();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!FOUNDER_EMAILS.includes(profile?.email)) return null;

  async function loadAll() {
    setLoading(true);
    const [settingsRes, tasksRes, profilesRes, kpiT, kpiTi, kpiW, notesRes] = await Promise.all([
      supabase.from('marae_settings').select('id, founder_metrics').limit(1).single(),
      supabase.from('tasks').select('id', { count: 'exact', head: true }).neq('status', 'completed').neq('status', 'cancelled'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      fetchEnvKPIs(supabase, 'Terere'),
      fetchEnvKPIs(supabaseTineka, 'Tineka'),
      fetchEnvKPIs(supabaseWaioweka, 'Waioweka'),
      supabase.from('founder_notes').select('marae_name, step_key, completed, data'),
    ]);

    if (settingsRes.data) {
      setSettingsId(settingsRes.data.id);
      const m = settingsRes.data.founder_metrics || {};
      if (m.mrr         !== undefined) setMrr(m.mrr);
      if (m.payingMarae !== undefined) setPayingMarae(m.payingMarae);
      if (m.shipped     !== undefined) setShipped(m.shipped);
      if (m.weekFocus) setWeekFocus(m.weekFocus);
      if (m.terere)    setTerere(m.terere);
      if (m.tineka)    setTineka(m.tineka);
      if (m.waioweka)  setWaioweka(m.waioweka);
    }

    setTaskCount(tasksRes.count || 0);
    setActiveUsers(profilesRes.count || 0);
    setKpiTerere(kpiT);
    setKpiTineka(kpiTi);
    setKpiWaioweka(kpiW);

    const cl = {}, leads = [], marae = [];
    for (const row of (notesRes.data || [])) {
      if (row.step_key === 'lost_lead') {
        leads.push({ id: row.marae_name, ...(row.data || {}) });
      } else if (row.step_key === 'custom_marae') {
        marae.push({ prefix: row.marae_name, label: row.data?.label || row.marae_name });
      } else {
        if (!cl[row.marae_name]) cl[row.marae_name] = {};
        cl[row.marae_name][row.step_key] = row.completed;
      }
    }
    setChecklist(cl);
    setLostLeads(leads);
    setCustomMarae(marae);

    setLoading(false);
  }

  async function toggleStep(maraeName, stepKey, current) {
    const next = !current;
    setChecklist(c => ({ ...c, [maraeName]: { ...c[maraeName], [stepKey]: next } }));
    await supabase.from('founder_notes').upsert(
      { marae_name: maraeName, step_key: stepKey, completed: next, updated_at: new Date().toISOString() },
      { onConflict: 'marae_name,step_key' }
    );
  }

  async function addMarae() {
    const label = newMaraeName.trim();
    if (!label) return;
    const prefix = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    if (customMarae.some(m => m.prefix === prefix)) return;
    const entry = { prefix, label };
    setCustomMarae(m => [...m, entry]);
    setNewMaraeName('');
    setAddingMarae(false);
    await supabase.from('founder_notes').upsert(
      { marae_name: prefix, step_key: 'custom_marae', completed: false, data: { label }, updated_at: new Date().toISOString() },
      { onConflict: 'marae_name,step_key' }
    );
  }

  async function deleteMarae(prefix) {
    setCustomMarae(m => m.filter(e => e.prefix !== prefix));
    await supabase.from('founder_notes').delete()
      .eq('marae_name', prefix).eq('step_key', 'custom_marae');
  }

  async function addLostLead() {
    if (!newLead.name.trim()) return;
    const id = `ll_${Date.now()}`;
    const row = { id, ...newLead };
    setLostLeads(l => [...l, row]);
    setNewLead(BLANK_LEAD);
    setAddingLead(false);
    await supabase.from('founder_notes').insert({
      marae_name: id, step_key: 'lost_lead', completed: false,
      data: newLead, updated_at: new Date().toISOString(),
    });
  }

  async function deleteLostLead(id) {
    setLostLeads(l => l.filter(r => r.id !== id));
    await supabase.from('founder_notes').delete()
      .eq('marae_name', id).eq('step_key', 'lost_lead');
  }

  async function saveMetrics() {
    if (!settingsId) return;
    const payload = { mrr, payingMarae, shipped, weekFocus, terere, tineka, waioweka };
    await supabase.from('marae_settings').update({ founder_metrics: payload }).eq('id', settingsId);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const launch        = new Date('2026-09-07');
  const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0);
  const daysToLaunch  = Math.ceil((launch - todayMidnight) / (1000 * 60 * 60 * 24));
  const launchColor   = daysToLaunch <= 14 ? RED : daysToLaunch <= 30 ? AMBER : GREEN;

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: TEXT3, fontSize: 14 }}>
        Loading founder data...
      </div>
    );
  }

  const fixedSections = [
    { label: 'Terere Marae',      kpi: kpiTerere,   prefix: 'terere',   custom: false },
    { label: 'Tineka Marae',       kpi: kpiTineka,   prefix: 'tineka',   custom: false },
    { label: 'Waioweka (Sandbox)', kpi: kpiWaioweka, prefix: 'waioweka', custom: false },
  ];
  const envSections = [
    ...fixedSections,
    ...customMarae.map(m => ({ label: m.label, kpi: null, prefix: m.prefix, custom: true })),
  ];

  // Shared card interior for trial dates + checklist
  function MaraeDatesAndChecklist({ prefix }) {
    const done = ONBOARDING_STEPS.filter(s => checklist[prefix]?.[s.key]).length;
    return (
      <>
        {/* Trial / Live dates */}
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${BORDER}` }}>
          {[
            { key: `${prefix}_trial_start`, label: 'Trial Started' },
            { key: `${prefix}_trial_end`,   label: 'Trial Ends' },
            { key: `${prefix}_goes_live`,   label: 'Goes Live' },
          ].map(({ key, dLabel = key }) => {
            const label = key === `${prefix}_trial_start` ? 'Trial Started'
                        : key === `${prefix}_trial_end`   ? 'Trial Ends'
                        : 'Goes Live';
            return (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: TEXT3 }}>{label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {!trialDates[key] && <span style={{ fontSize: 11, color: TEXT3, fontStyle: 'italic' }}>Not set</span>}
                  <input
                    type="date"
                    value={trialDates[key] || ''}
                    onChange={e => setTrialDate(key, e.target.value)}
                    style={{ fontSize: 12, color: trialDates[key] ? TEXT1 : TEXT3, border: `1px solid ${BORDER}`, borderRadius: 6, padding: '4px 8px', background: WHITE, cursor: 'pointer', outline: 'none' }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Onboarding checklist */}
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${BORDER}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: TEXT1 }}>Onboarding</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: done === ONBOARDING_STEPS.length ? GREEN : TEXT3 }}>
              {done}/{ONBOARDING_STEPS.length} steps
            </span>
          </div>
          {ONBOARDING_STEPS.map(({ key, label: sLabel }) => {
            const checked = checklist[prefix]?.[key] || false;
            return (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 9, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleStep(prefix, key, checked)}
                  style={{ width: 14, height: 14, accentColor: GREEN, cursor: 'pointer', flexShrink: 0 }}
                />
                <span style={{ fontSize: 12, color: checked ? TEXT3 : TEXT1, textDecoration: checked ? 'line-through' : 'none' }}>
                  {sLabel}
                </span>
              </label>
            );
          })}
        </div>
      </>
    );
  }

  const tdStyle = { fontSize: 13, color: TEXT1, padding: '9px 12px 9px 0', borderBottom: `1px solid ${BORDER}`, verticalAlign: 'top' };
  const thStyle = { fontSize: 11, fontWeight: 700, color: TEXT3, textTransform: 'uppercase', letterSpacing: 0.5, padding: '0 12px 10px 0', borderBottom: `1px solid ${BORDER}`, textAlign: 'left' };
  const inStyle = { width: '100%', padding: '6px 8px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 12, color: TEXT1, background: WHITE, outline: 'none', boxSizing: 'border-box' };

  return (
    <div style={{ background: CREAM, minHeight: '100vh', padding: '28px 32px', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, fontWeight: 700, color: GREEN }}>Founder Dashboard</div>
          <div style={{ fontSize: 13, color: TEXT3, marginTop: 3 }}>MaraeHub · Private view</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={loadAll} style={{ padding: '8px 16px', border: `1px solid ${BORDER}`, background: WHITE, borderRadius: 8, fontSize: 13, cursor: 'pointer', color: TEXT1 }}>
            Refresh
          </button>
          <button onClick={saveMetrics} style={{ padding: '8px 16px', background: GREEN, color: WHITE, border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {saved ? 'Saved ✓' : 'Save'}
          </button>
        </div>
      </div>

      {/* ── TOP STAT CARDS ─────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <Card>
          <div style={{ fontSize: 12, color: TEXT3, marginBottom: 6 }}>MRR</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: mrr > 0 ? GREEN : RED }}>${mrr.toLocaleString()}</div>
          <div style={{ fontSize: 11, color: TEXT3, marginTop: 4 }}>Monthly recurring</div>
        </Card>
        <Card>
          <div style={{ fontSize: 12, color: TEXT3, marginBottom: 6 }}>Paying Marae</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: payingMarae > 0 ? GREEN : RED }}>{payingMarae}</div>
          <div style={{ fontSize: 11, color: TEXT3, marginTop: 4 }}>Active subscriptions</div>
        </Card>
        <Card>
          <div style={{ fontSize: 12, color: TEXT3, marginBottom: 6 }}>Active This Week</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: TEXT1 }}>{activeUsers}</div>
          <div style={{ fontSize: 11, color: TEXT3, marginTop: 4 }}>Total users in system</div>
        </Card>
      </div>

      {/* ── MARAEHUB REVENUE ───────────────────────────────────────────── */}
      <Card style={{ marginBottom: 24 }}>
        <SectionTitle>MaraeHub Revenue</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24 }}>
          <div>
            <FieldInput label="MRR ($)" value={mrr} onChange={setMrr} type="number" placeholder="0" />
            <FieldInput label="Paying Marae" value={payingMarae} onChange={setPayingMarae} type="number" placeholder="0" />
            <FieldInput label="Last Shipped" value={shipped} onChange={setShipped} placeholder="e.g. Workflow automation" />
          </div>
          <div style={{ borderLeft: `1px solid ${BORDER}`, paddingLeft: 24 }}>
            <StatRow label="Open Tasks"        value={taskCount} />
            <StatRow label="Upcoming Bookings" value={kpiTerere?.bookings ?? '—'} />
            <StatRow label="Compliance Items"  value={kpiTerere?.compliance ?? '—'} />
            <StatRow label="Assets"            value={kpiTerere?.assets ?? '—'} />
          </div>
          <div style={{ borderLeft: `1px solid ${BORDER}`, paddingLeft: 24, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ fontSize: 11, color: TEXT3, marginBottom: 4 }}>Days to Sep 7 launch</div>
            <div style={{ fontSize: 52, fontWeight: 700, color: launchColor, lineHeight: 1 }}>{daysToLaunch}</div>
            <div style={{ fontSize: 11, color: TEXT3, marginTop: 4 }}>September 7, 2026</div>
          </div>
        </div>
      </Card>

      {/* ── MARAE STATUS / WEEKLY FOCUS ────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <Card>
          <SectionTitle>Marae Status</SectionTitle>
          {[
            { label: 'Terere',   state: terere,   set: setTerere },
            { label: 'Tineka',   state: tineka,   set: setTineka },
            { label: 'Waioweka', state: waioweka, set: setWaioweka },
          ].map(({ label, state, set }, i, arr) => {
            const pill = MARAE_PILL[state.status] || { color: TEXT3, bg: CREAM };
            return (
              <div key={label} style={{ marginBottom: i < arr.length - 1 ? 16 : 0, paddingBottom: i < arr.length - 1 ? 16 : 0, borderBottom: i < arr.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: TEXT1 }}>{label}</span>
                  <select
                    value={state.status}
                    onChange={e => set(s => ({ ...s, status: e.target.value }))}
                    style={{ fontSize: 12, padding: '3px 8px', border: `1px solid ${BORDER}`, borderRadius: 6, background: WHITE, color: TEXT1, cursor: 'pointer' }}
                  >
                    {['Active', 'Trial', 'Interested', 'Cold'].map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <Pill text={state.status} color={pill.color} bg={pill.bg} />
                <input
                  type="text"
                  value={state.note}
                  onChange={e => set(s => ({ ...s, note: e.target.value }))}
                  placeholder="Notes..."
                  style={{ width: '100%', marginTop: 8, padding: '6px 10px', border: `1px solid ${BORDER}`, borderRadius: 7, fontSize: 12, color: TEXT1, background: WHITE, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            );
          })}
        </Card>

        <Card>
          <SectionTitle>Weekly Focus</SectionTitle>
          <FieldInput label="Ship this week"    value={weekFocus.ship}    onChange={v => setWeekFocus(f => ({ ...f, ship: v }))}    placeholder="What to ship" />
          <FieldInput label="Contact this week" value={weekFocus.contact} onChange={v => setWeekFocus(f => ({ ...f, contact: v }))} placeholder="Who to contact" />
          <FieldInput label="Fix this week"     value={weekFocus.fix}     onChange={v => setWeekFocus(f => ({ ...f, fix: v }))}     placeholder="What to fix" />
        </Card>
      </div>

      {/* ── PER-ENVIRONMENT CARDS ──────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
        {envSections.map(({ label, kpi, prefix, custom }) => (
          <Card key={prefix}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 }}>
              <SectionTitle style={{ flex: 1 }}>🏛️ {label}</SectionTitle>
              {custom && (
                <button
                  onClick={() => deleteMarae(prefix)}
                  style={{ background: 'none', border: 'none', color: TEXT3, fontSize: 16, cursor: 'pointer', lineHeight: 1, padding: '0 0 0 8px', marginTop: -2 }}
                  title="Remove marae"
                >×</button>
              )}
            </div>

            {/* KPI block — fixed marae only */}
            {!custom && (
              kpi === null ? (
                <div style={{ fontSize: 13, color: TEXT3, marginBottom: 16 }}>
                  Not configured — add REACT_APP_WAIOWEKA_ANON_KEY to enable live data.
                </div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${BORDER}` }}>
                    {[
                      { label: 'Trustees',   value: kpi.trustees.length },
                      { label: 'Compliance', value: kpi.compliance },
                      { label: 'Bookings',   value: kpi.bookings },
                      { label: 'Assets',     value: kpi.assets },
                    ].map(({ label: kLabel, value }) => (
                      <div key={kLabel} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 22, fontWeight: 700, color: value > 0 ? GREEN : TEXT3 }}>{value}</div>
                        <div style={{ fontSize: 10, color: TEXT3, marginTop: 2 }}>{kLabel}</div>
                      </div>
                    ))}
                  </div>
                  {kpi.trustees.length === 0 ? (
                    <div style={{ fontSize: 13, color: TEXT3, marginBottom: 16 }}>No trustees found.</div>
                  ) : (
                    <div style={{ marginBottom: 4 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', paddingBottom: 8, marginBottom: 4, borderBottom: `1px solid ${BORDER}` }}>
                        {['Name', 'Email', 'Last Login'].map(h => (
                          <span key={h} style={{ fontSize: 10, fontWeight: 700, color: TEXT3, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</span>
                        ))}
                      </div>
                      {kpi.trustees.slice(0, 10).map(u => {
                        const now  = new Date();
                        const last = u.last_sign_in_at ? new Date(u.last_sign_in_at) : null;
                        const days = last ? Math.floor((now - last) / (1000 * 60 * 60 * 24)) : null;
                        const hasDate = 'last_sign_in_at' in u;
                        const color = !hasDate ? TEXT3 : days === null ? TEXT3 : days <= 7 ? GREEN : days <= 30 ? AMBER : RED;
                        const dateLabel = !hasDate ? 'not available'
                          : last ? last.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Never';
                        const ago = !hasDate || days === null ? '' : days === 0 ? ' (today)' : ` (${days}d ago)`;
                        return (
                          <div key={u.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '9px 0', borderBottom: `1px solid ${BORDER}` }}>
                            <span style={{ fontSize: 12, color: TEXT1, fontWeight: 500 }}>{u.full_name || '—'}</span>
                            <span style={{ fontSize: 11, color: TEXT3 }}>{u.email}</span>
                            <span style={{ fontSize: 12, fontWeight: 600, color }}>{dateLabel}{ago}</span>
                          </div>
                        );
                      })}
                      {kpi.trustees.length > 10 && (
                        <div style={{ fontSize: 11, color: TEXT3, fontStyle: 'italic', paddingTop: 10 }}>
                          {kpi.trustees.length - 10} more trustees — view all in Supabase
                        </div>
                      )}
                    </div>
                  )}
                </>
              )
            )}

            {/* Custom marae label */}
            {custom && (
              <div style={{ fontSize: 12, color: TEXT3, marginBottom: 4 }}>Prospect marae — no live environment yet.</div>
            )}

            {/* Trial dates + checklist — always */}
            <MaraeDatesAndChecklist prefix={prefix} />
          </Card>
        ))}

        {/* Add New Marae card / button */}
        {addingMarae ? (
          <Card style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 120 }}>
            <div style={{ fontSize: 12, color: TEXT3, marginBottom: 8 }}>Marae name</div>
            <input
              autoFocus
              value={newMaraeName}
              onChange={e => setNewMaraeName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addMarae(); if (e.key === 'Escape') { setAddingMarae(false); setNewMaraeName(''); } }}
              placeholder="e.g. Ngāti Hine"
              style={{ ...inStyle, marginBottom: 12, fontSize: 13 }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={addMarae} style={{ flex: 1, padding: '8px', background: GREEN, color: WHITE, border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Add
              </button>
              <button onClick={() => { setAddingMarae(false); setNewMaraeName(''); }} style={{ padding: '8px 14px', border: `1px solid ${BORDER}`, background: WHITE, borderRadius: 7, fontSize: 13, cursor: 'pointer', color: TEXT3 }}>
                Cancel
              </button>
            </div>
          </Card>
        ) : (
          <button
            onClick={() => setAddingMarae(true)}
            style={{ border: `2px dashed ${BORDER}`, borderRadius: 12, background: 'transparent', cursor: 'pointer', color: TEXT3, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 120, transition: 'border-color 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = GREEN}
            onMouseLeave={e => e.currentTarget.style.borderColor = BORDER}
          >
            <span style={{ fontSize: 20, fontWeight: 300, lineHeight: 1 }}>+</span>
            <span>Add New Marae</span>
          </button>
        )}
      </div>

      {/* ── LOST LEADS ─────────────────────────────────────────────────── */}
      <Card style={{ marginTop: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <SectionTitle style={{ marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }}>Lost Leads</SectionTitle>
          {!addingLead && (
            <button
              onClick={() => setAddingLead(true)}
              style={{ padding: '6px 14px', background: GREEN, color: WHITE, border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              + Add
            </button>
          )}
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Marae', 'Date', 'Reason Declined', 'Lesson Learned', ''].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lostLeads.length === 0 && !addingLead && (
              <tr>
                <td colSpan={5} style={{ ...tdStyle, color: TEXT3, fontStyle: 'italic' }}>No lost leads recorded.</td>
              </tr>
            )}
            {lostLeads.map(row => (
              <tr key={row.id}>
                <td style={{ ...tdStyle, fontWeight: 500 }}>{row.name}</td>
                <td style={{ ...tdStyle, color: TEXT3, whiteSpace: 'nowrap' }}>{row.date || '—'}</td>
                <td style={tdStyle}>{row.reason}</td>
                <td style={tdStyle}>{row.lesson}</td>
                <td style={{ ...tdStyle, textAlign: 'right', width: 32 }}>
                  <button
                    onClick={() => deleteLostLead(row.id)}
                    style={{ background: 'none', border: 'none', color: TEXT3, fontSize: 16, cursor: 'pointer', lineHeight: 1, padding: 0 }}
                    title="Delete"
                  >×</button>
                </td>
              </tr>
            ))}

            {/* Inline add row */}
            {addingLead && (
              <tr>
                <td style={{ ...tdStyle, paddingRight: 8 }}>
                  <input autoFocus value={newLead.name} onChange={e => setNewLead(l => ({ ...l, name: e.target.value }))} placeholder="Marae name" style={inStyle} />
                </td>
                <td style={{ ...tdStyle, paddingRight: 8 }}>
                  <input type="date" value={newLead.date} onChange={e => setNewLead(l => ({ ...l, date: e.target.value }))} style={inStyle} />
                </td>
                <td style={{ ...tdStyle, paddingRight: 8 }}>
                  <input value={newLead.reason} onChange={e => setNewLead(l => ({ ...l, reason: e.target.value }))} placeholder="Why they said no" style={inStyle} />
                </td>
                <td style={{ ...tdStyle, paddingRight: 8 }}>
                  <input value={newLead.lesson} onChange={e => setNewLead(l => ({ ...l, lesson: e.target.value }))} placeholder="What to do differently" style={inStyle} onKeyDown={e => e.key === 'Enter' && addLostLead()} />
                </td>
                <td style={{ ...tdStyle, verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={addLostLead} style={{ padding: '5px 10px', background: GREEN, color: WHITE, border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Save</button>
                    <button onClick={() => { setAddingLead(false); setNewLead(BLANK_LEAD); }} style={{ padding: '5px 10px', border: `1px solid ${BORDER}`, background: WHITE, borderRadius: 6, fontSize: 12, cursor: 'pointer', color: TEXT3 }}>Cancel</button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {/* ── FOOTER ─────────────────────────────────────────────────────── */}
      <div style={{ marginTop: 24, textAlign: 'center', fontSize: 11, color: TEXT3 }}>
        MaraeHub Founder View · Private · {new Date().toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' })}
      </div>

    </div>
  );
}
