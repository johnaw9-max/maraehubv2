import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { supabaseTineka, supabaseWaioweka } from '../lib/supabaseMulti';

const FOUNDER_EMAILS = ['johnaw9@gmail.com', 'waj@maraehub.co.nz'];
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
  Active:     { color: GREEN,       bg: '#E6F4F0' },
  Trial:      { color: AMBER,       bg: '#FDF3E3' },
  Interested: { color: '#4A6FA5',   bg: '#EAF0FA' },
  Cold:       { color: TEXT3,       bg: CREAM },
};

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

  const [liveCounts, setLiveCounts] = useState({ tasks: 0, compliance: 0, bookings: 0, activeUsers: 0 });
  const [loginTerere,   setLoginTerere]   = useState([]);
  const [loginTineka,   setLoginTineka]   = useState([]);
  const [loginWaioweka, setLoginWaioweka] = useState([]);

  useEffect(() => {
    if (!FOUNDER_EMAILS.includes(profile?.email)) return;
    loadAll();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!FOUNDER_EMAILS.includes(profile?.email)) return null;

  async function fetchLoginActivity(client, withLogin = true, label = '') {
    if (!client) return null;
    if (withLogin) {
      const { data, error } = await client.rpc('get_trustee_login_activity');
      if (!error && data) return data;
    }
    const { data: profiles, error: profilesError } = await client
      .from('profiles')
      .select('id, full_name, email')
      .order('full_name');
    console.log(`[FounderDashboard] ${label} profiles query:`, { data: profiles, error: profilesError });
    return profiles || [];
  }

  async function loadAll() {
    setLoading(true);
    const todayStr = new Date().toISOString().split('T')[0];
    const [settingsRes, tasksRes, compRes, bookRes, profilesRes, loginT, loginTi, loginW] = await Promise.all([
      supabase.from('marae_settings').select('id, founder_metrics').limit(1).single(),
      supabase.from('tasks').select('id', { count: 'exact', head: true }).neq('status', 'completed').neq('status', 'cancelled'),
      supabase.from('compliance_items').select('id', { count: 'exact', head: true }),
      supabase.from('bookings').select('id', { count: 'exact', head: true }).gte('start_date', todayStr),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      fetchLoginActivity(supabase, true, 'Terere'),
      fetchLoginActivity(supabaseTineka, false, 'Tineka'),
      fetchLoginActivity(supabaseWaioweka, false, 'Waioweka'),
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

    setLiveCounts({
      tasks:       tasksRes.count    || 0,
      compliance:  compRes.count     || 0,
      bookings:    bookRes.count     || 0,
      activeUsers: profilesRes.count || 0,
    });
    setLoginTerere(loginT || []);
    setLoginTineka(loginTi || []);
    setLoginWaioweka(loginW);

    setLoading(false);
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
          <div style={{ fontSize: 32, fontWeight: 700, color: TEXT1 }}>{liveCounts.activeUsers}</div>
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
            <StatRow label="Open Tasks"        value={liveCounts.tasks} />
            <StatRow label="Upcoming Bookings" value={liveCounts.bookings} />
            <StatRow label="Compliance Items"  value={liveCounts.compliance} />
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

      {/* ── LOGIN ACTIVITY ─────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        {[
          { label: 'Terere Marae',       users: loginTerere,   hasLoginDates: true },
          { label: 'Tineka Marae',        users: loginTineka,   hasLoginDates: false },
          { label: 'Waioweka (Sandbox)',  users: loginWaioweka, hasLoginDates: false },
        ].map(({ label, users, hasLoginDates }) => (
          <Card key={label}>
            <SectionTitle>🏛️ {label} — last login activity</SectionTitle>
            {users === null ? (
              <div style={{ fontSize: 13, color: TEXT3 }}>Not configured — add REACT_APP_WAIOWEKA_ANON_KEY to enable.</div>
            ) : users.length === 0 ? (
              <div style={{ fontSize: 13, color: TEXT3 }}>No trustee data available.</div>
            ) : (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', paddingBottom: 8, marginBottom: 4, borderBottom: `1px solid ${BORDER}` }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: TEXT3, textTransform: 'uppercase', letterSpacing: 0.5 }}>Name</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: TEXT3, textTransform: 'uppercase', letterSpacing: 0.5 }}>Email</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: TEXT3, textTransform: 'uppercase', letterSpacing: 0.5 }}>Last Login</span>
                </div>
                {users.map(u => {
                  const now  = new Date();
                  const last = hasLoginDates && u.last_sign_in_at ? new Date(u.last_sign_in_at) : null;
                  const days = last ? Math.floor((now - last) / (1000 * 60 * 60 * 24)) : null;
                  const color = !hasLoginDates ? TEXT3 : days === null ? TEXT3 : days <= 7 ? GREEN : days <= 30 ? AMBER : RED;
                  const dateLabel = !hasLoginDates
                    ? 'not available'
                    : last
                      ? last.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })
                      : 'Never';
                  const ago = !hasLoginDates || days === null ? '' : days === 0 ? ' (today)' : ` (${days}d ago)`;
                  return (
                    <div key={u.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '10px 0', borderBottom: `1px solid ${BORDER}` }}>
                      <span style={{ fontSize: 13, color: TEXT1, fontWeight: 500 }}>{u.full_name || '—'}</span>
                      <span style={{ fontSize: 12, color: TEXT3 }}>{u.email}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color }}>{dateLabel}{ago}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* ── FOOTER ─────────────────────────────────────────────────────── */}
      <div style={{ marginTop: 24, textAlign: 'center', fontSize: 11, color: TEXT3 }}>
        MaraeHub Founder View · Private · {new Date().toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' })}
      </div>

    </div>
  );
}
