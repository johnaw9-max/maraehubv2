import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const FOUNDER_EMAILS = ['johnaw9@gmail.com', 'waj@maraehub.co.nz'];
const SALARY_TARGET = 6000;
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

function ProgressBar({ value, max, color }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div style={{ background: CREAM, borderRadius: 8, height: 10, overflow: 'hidden', marginTop: 6 }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color || GREEN, borderRadius: 8, transition: 'width 0.3s' }} />
    </div>
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
  const [iretoro, setIretoro]        = useState(3200);
  const [wroughton, setWroughton]    = useState(1800);
  const [weekFocus, setWeekFocus]    = useState({ ship: '', contact: '', fix: '' });
  const [saved, setSaved]            = useState(false);
  const [loading, setLoading]        = useState(true);
  const [metrics, setMetrics]        = useState({});
  const [settingsId, setSettingsId]  = useState(null);

  const [terere,   setTerere]   = useState({ status: 'Active',     note: '' });
  const [tineka,   setTineka]   = useState({ status: 'Trial',      note: '' });
  const [waioweka, setWaioweka] = useState({ status: 'Interested', note: '' });

  const [kopara, setKopara] = useState({ tenant: '', rent: '', leaseExpiry: '', maintenance: '', status: '' });
  const [liveCounts, setLiveCounts] = useState({ tasks: 0, compliance: 0, bookings: 0, activeUsers: 0 });

  useEffect(() => {
    if (!FOUNDER_EMAILS.includes(profile?.email)) return;
    loadAll();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!FOUNDER_EMAILS.includes(profile?.email)) return null;

  async function loadAll() {
    setLoading(true);
    const todayStr = new Date().toISOString().split('T')[0];
    const [settingsRes, tasksRes, compRes, bookRes, profilesRes] = await Promise.all([
      supabase.from('marae_settings').select('id, founder_metrics').limit(1).single(),
      supabase.from('tasks').select('id', { count: 'exact', head: true }).neq('status', 'completed').neq('status', 'cancelled'),
      supabase.from('compliance_items').select('id', { count: 'exact', head: true }),
      supabase.from('bookings').select('id', { count: 'exact', head: true }).gte('start_date', todayStr),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
    ]);

    if (settingsRes.data) {
      setSettingsId(settingsRes.data.id);
      const m = settingsRes.data.founder_metrics || {};
      setMetrics(m);
      if (m.mrr        !== undefined) setMrr(m.mrr);
      if (m.payingMarae !== undefined) setPayingMarae(m.payingMarae);
      if (m.shipped    !== undefined) setShipped(m.shipped);
      if (m.iretoro    !== undefined) setIretoro(m.iretoro);
      if (m.wroughton  !== undefined) setWroughton(m.wroughton);
      if (m.weekFocus) setWeekFocus(m.weekFocus);
      if (m.terere)    setTerere(m.terere);
      if (m.tineka)    setTineka(m.tineka);
      if (m.waioweka)  setWaioweka(m.waioweka);
      if (m.kopara)    setKopara(m.kopara);
    }

    setLiveCounts({
      tasks:       tasksRes.count    || 0,
      compliance:  compRes.count     || 0,
      bookings:    bookRes.count     || 0,
      activeUsers: profilesRes.count || 0,
    });

    setLoading(false);
  }

  async function saveMetrics() {
    if (!settingsId) return;
    const payload = { mrr, payingMarae, shipped, iretoro, wroughton, weekFocus, terere, tineka, waioweka, kopara };
    await supabase.from('marae_settings').update({ founder_metrics: payload }).eq('id', settingsId);
    setMetrics(payload);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const totalIncome  = mrr + iretoro + wroughton;
  const freedom      = Math.min(100, Math.round((totalIncome / SALARY_TARGET) * 100));
  const freedomColor = freedom >= 100 ? GREEN : freedom >= 60 ? AMBER : RED;

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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
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
          <div style={{ fontSize: 12, color: TEXT3, marginBottom: 6 }}>Freedom Progress</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: freedomColor }}>{freedom}%</div>
          <ProgressBar value={totalIncome} max={SALARY_TARGET} color={freedomColor} />
        </Card>
        <Card>
          <div style={{ fontSize: 12, color: TEXT3, marginBottom: 6 }}>Active This Week</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: TEXT1 }}>{liveCounts.activeUsers}</div>
          <div style={{ fontSize: 11, color: TEXT3, marginTop: 4 }}>Total users in system</div>
        </Card>
      </div>

      {/* ── ROW 2: MaraeHub / Rental / Freedom ─────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
        <Card>
          <SectionTitle>MaraeHub Revenue</SectionTitle>
          <FieldInput label="MRR ($)" value={mrr} onChange={setMrr} type="number" placeholder="0" />
          <FieldInput label="Paying Marae" value={payingMarae} onChange={setPayingMarae} type="number" placeholder="0" />
          <FieldInput label="Last Shipped" value={shipped} onChange={setShipped} placeholder="e.g. Workflow automation" />
          <div style={{ marginTop: 8, borderTop: `1px solid ${BORDER}`, paddingTop: 12 }}>
            <StatRow label="Open Tasks"         value={liveCounts.tasks} />
            <StatRow label="Upcoming Bookings"  value={liveCounts.bookings} />
            <StatRow label="Compliance Items"   value={liveCounts.compliance} />
          </div>
        </Card>

        <Card>
          <SectionTitle>Rental Income</SectionTitle>
          <FieldInput label="Iretoro St ($/mo)"   value={iretoro}   onChange={setIretoro}   type="number" placeholder="3200" />
          <FieldInput label="Wroughton St ($/mo)"  value={wroughton} onChange={setWroughton} type="number" placeholder="1800" />
          <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 12, marginTop: 4 }}>
            <StatRow label="Total Rental" value={`$${(iretoro + wroughton).toLocaleString()}`} bold />
            <StatRow label="MRR"          value={`$${mrr.toLocaleString()}`} />
            <StatRow label="Total Income" value={`$${totalIncome.toLocaleString()}`} bold color={GREEN} />
          </div>
        </Card>

        <Card>
          <SectionTitle>Freedom Number</SectionTitle>
          <div style={{ textAlign: 'center', padding: '12px 0 16px' }}>
            <div style={{ fontSize: 52, fontWeight: 700, color: freedomColor, lineHeight: 1 }}>{freedom}%</div>
            <div style={{ fontSize: 12, color: TEXT3, marginTop: 6 }}>of ${SALARY_TARGET.toLocaleString()} target</div>
          </div>
          <ProgressBar value={totalIncome} max={SALARY_TARGET} color={freedomColor} />
          <div style={{ marginTop: 16 }}>
            <StatRow label="Rental"        value={`$${(iretoro + wroughton).toLocaleString()}`} />
            <StatRow label="MaraeHub MRR"  value={`$${mrr.toLocaleString()}`} />
            <StatRow
              label="Gap to Target"
              value={`$${Math.max(0, SALARY_TARGET - totalIncome).toLocaleString()}`}
              color={totalIncome >= SALARY_TARGET ? GREEN : RED}
              bold
            />
          </div>
        </Card>
      </div>

      {/* ── ROW 3: Marae Status / Weekly Focus ─────────────────────────── */}
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
          <div style={{ background: CREAM, borderRadius: 10, padding: '14px 16px', marginBottom: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: TEXT3, marginBottom: 4 }}>Days to Sep 7 launch</div>
            <div style={{ fontSize: 42, fontWeight: 700, color: launchColor, lineHeight: 1 }}>{daysToLaunch}</div>
            <div style={{ fontSize: 11, color: TEXT3, marginTop: 4 }}>September 7, 2026</div>
          </div>
          <FieldInput label="Ship this week"    value={weekFocus.ship}    onChange={v => setWeekFocus(f => ({ ...f, ship: v }))}    placeholder="What to ship" />
          <FieldInput label="Contact this week" value={weekFocus.contact} onChange={v => setWeekFocus(f => ({ ...f, contact: v }))} placeholder="Who to contact" />
          <FieldInput label="Fix this week"     value={weekFocus.fix}     onChange={v => setWeekFocus(f => ({ ...f, fix: v }))}     placeholder="What to fix" />
        </Card>
      </div>

      {/* ── KOPARA PLACE RESILIENCE ─────────────────────────────────────── */}
      <Card>
        <SectionTitle>Kopara Place — Resilience</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
          {[
            { key: 'tenant',      label: 'Tenant',      placeholder: 'Tenant name' },
            { key: 'rent',        label: 'Rent ($/mo)',  placeholder: '0' },
            { key: 'leaseExpiry', label: 'Lease Expiry', placeholder: 'dd/mm/yyyy' },
            { key: 'maintenance', label: 'Maintenance',  placeholder: 'Any issues' },
            { key: 'status',      label: 'Status',       placeholder: 'e.g. Occupied' },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <div style={{ fontSize: 11, color: TEXT3, marginBottom: 6 }}>{label}</div>
              <input
                type="text"
                value={kopara[key]}
                onChange={e => setKopara(k => ({ ...k, [key]: e.target.value }))}
                placeholder={placeholder}
                style={{ width: '100%', padding: '7px 10px', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, color: TEXT1, background: WHITE, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          ))}
        </div>
      </Card>

      {/* ── FOOTER ─────────────────────────────────────────────────────── */}
      <div style={{ marginTop: 24, textAlign: 'center', fontSize: 11, color: TEXT3 }}>
        MaraeHub Founder View · Private · {new Date().toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' })}
      </div>

    </div>
  );
}
