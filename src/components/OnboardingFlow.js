import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const GREEN  = '#0F6E56';
const AMBER  = '#BA7517'; // eslint-disable-line no-unused-vars
const CREAM  = '#F5F2EA';
const BORDER = '#E0DDD5';
const WHITE  = '#FFFFFF';
const TEXT1  = '#1A1A18';
const TEXT3  = '#888884';

const ASSET_CATEGORIES = ['Building', 'Equipment', 'Vehicle', 'Technology', 'Grounds', 'Other'];
const SERVICE_TYPES    = ['Annual WOF', 'Oil Change', 'Safety Inspection', 'Filter Replacement', 'Servicing', 'Other'];
const QUICK_COMPLIANCE = [
  'Building WOF',
  'Public Liability Insurance',
  'H&S Policy Review',
  'Civil Defence Emergency Plan',
  'First Aid Kit Inspection',
  'Fire Evacuation Plan',
];

const STEPS = [
  { num: 1, title: 'Your Marae',       icon: '🏛️', sub: 'Tell us about your marae' },
  { num: 2, title: 'Invite a Trustee', icon: '👥', sub: 'Invite another trustee to join MaraeHub' },
  { num: 3, title: 'First Asset',      icon: '🔧', sub: 'Add your first asset and set a service reminder' },
  { num: 4, title: 'Compliance Item',  icon: '✅', sub: 'Track an important compliance obligation' },
  { num: 5, title: 'Next Hui',         icon: '📅', sub: 'Schedule your next trustee hui' },
];

export default function OnboardingFlow({ onComplete }) {
  const [step, setStep]             = useState(1);
  const [settingsId, setSettingsId] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [hidden, setHidden]         = useState(false);
  const [error, setError]           = useState('');

  // Step 1
  const [maraeName, setMaraeName] = useState('');
  const [location,  setLocation]  = useState('');
  const [iwi,  setIwi]            = useState('');
  const [hapu, setHapu]           = useState('');

  // Step 2
  const [inviteEmail,  setInviteEmail]  = useState('');
  const [inviteResult, setInviteResult] = useState('');
  const [inviting,     setInviting]     = useState(false);

  // Step 3
  const [assetName,     setAssetName]     = useState('');
  const [assetCategory, setAssetCategory] = useState('Building');
  const [serviceDate,   setServiceDate]   = useState('');
  const [serviceType,   setServiceType]   = useState('');

  // Step 4
  const [compItem, setCompItem] = useState('');
  const [compDue,  setCompDue]  = useState('');

  // Step 5
  const [huiDate,     setHuiDate]     = useState('');
  const [huiTime,     setHuiTime]     = useState('');
  const [huiLocation, setHuiLocation] = useState('');
  const [huiNotes,    setHuiNotes]    = useState('');

  useEffect(() => { loadOnboarding(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadOnboarding() {
    const { data } = await supabase
      .from('marae_settings')
      .select('id, marae_name, location, iwi, hapu, onboarding_complete, onboarding_step')
      .limit(1)
      .single();
    if (data) {
      if (data.onboarding_complete) { setHidden(true); setLoading(false); return; }
      setSettingsId(data.id);
      const resume = Math.max(1, Math.min((data.onboarding_step || 0) + 1, 5));
      setStep(resume);
      if (data.marae_name) setMaraeName(data.marae_name);
      if (data.location)   setLocation(data.location);
      if (data.iwi)        setIwi(data.iwi);
      if (data.hapu)       setHapu(data.hapu);
    }
    setLoading(false);
  }

  async function advanceStep(num, extra = {}) {
    if (settingsId) {
      await supabase.from('marae_settings').update({ onboarding_step: num, ...extra }).eq('id', settingsId);
    }
  }

  async function skipAll() {
    if (settingsId) {
      await supabase.from('marae_settings').update({ onboarding_complete: true }).eq('id', settingsId);
    }
    setHidden(true);
    onComplete?.();
  }

  // ── STEP SAVES ─────────────────────────────────────────────────────────────

  async function saveStep1() {
    if (!maraeName.trim()) { setError('Marae name is required'); return; }
    setSaving(true); setError('');
    if (settingsId) {
      await supabase.from('marae_settings').update({
        marae_name: maraeName.trim(),
        location:   location.trim(),
        iwi:        iwi.trim(),
        hapu:       hapu.trim(),
      }).eq('id', settingsId);
    }
    await advanceStep(1);
    setSaving(false);
    setStep(2);
  }

  async function saveStep2(skip = false) {
    setError('');
    if (!skip) {
      if (!inviteEmail.trim() || !inviteEmail.includes('@')) { setError('Enter a valid email address'); return; }
      setSaving(true);
      setInviting(true);
      const { data, error: fnErr } = await supabase.functions.invoke('invite-trustee', {
        body: { email: inviteEmail.trim().toLowerCase(), redirectTo: window.location.origin },
      });
      setInviting(false);
      if (fnErr || data?.error) {
        setError(fnErr?.message || data?.error || 'Failed to send invite');
        setSaving(false);
        return;
      }
      setInviteResult(data?.alreadyRegistered
        ? `${inviteEmail} already has an account — they can log in now.`
        : `Invite sent to ${inviteEmail}.`
      );
    }
    await advanceStep(2);
    setSaving(false);
    if (skip) setStep(3);
  }

  async function proceedFromStep2() {
    await advanceStep(2);
    setStep(3);
  }

  async function saveStep3(skip = false) {
    setError('');
    if (!skip) {
      if (!assetName.trim()) { setError('Asset name is required'); return; }
      setSaving(true);
      const { data: asset } = await supabase
        .from('assets')
        .insert({ name: assetName.trim(), category: assetCategory, condition: 'good' })
        .select('id')
        .single();
      if (asset && serviceDate && serviceType.trim()) {
        await supabase.from('service_reminders').insert({
          asset_id: asset.id,
          type:     serviceType.trim(),
          due_date: serviceDate,
          recurring: 'annual',
        });
      }
    }
    await advanceStep(3);
    setSaving(false);
    setStep(4);
  }

  async function saveStep4(skip = false) {
    setError('');
    if (!skip) {
      if (!compItem.trim()) { setError('Select or enter a compliance item'); return; }
      setSaving(true);
      await supabase.from('compliance_items').insert({
        name:     compItem.trim(),
        category: 'General',
        due_date: compDue || null,
      });
    }
    await advanceStep(4);
    setSaving(false);
    setStep(5);
  }

  async function saveStep5(skip = false) {
    setError('');
    if (!skip) {
      if (!huiDate) { setError('Please select a date for the hui'); return; }
      setSaving(true);
      await supabase.from('bookings').insert({
        occasion:   'Trustee Hui',
        start_date: huiDate,
        end_date:   huiDate,
        guests:     0,
        status:     'approved',
        notes:      huiNotes.trim() || null,
      });
    }
    if (settingsId) {
      await supabase.from('marae_settings').update({ onboarding_complete: true, onboarding_step: 5 }).eq('id', settingsId);
    }
    setSaving(false);
    setCelebrating(true);
  }

  // ── RENDER ─────────────────────────────────────────────────────────────────

  if (loading || hidden) return null;

  if (celebrating) {
    const weekDays = [
      {
        label: 'Day 1 — Get oriented',
        steps: [
          'Go to Board View — your marae command centre',
          'Check anything flagged — bookings, compliance, assets',
          'Familiarise yourself with the left navigation menu',
        ],
      },
      {
        label: 'Day 2 — Set up your core records',
        steps: [
          'Compliance — add insurance, licenses, certificates',
          'Assets — add buildings, vehicles, equipment',
          'Contacts — add your key contacts',
        ],
      },
      {
        label: 'Day 3 — Run your first process',
        steps: [
          'Bookings — add or approve your first booking',
          'Finance — check income was created automatically',
          'Workflows — start a workflow if needed',
        ],
      },
    ];

    return (
      <div style={{ background: WHITE, border: `2px solid ${GREEN}`, borderRadius: 14, padding: '40px 32px', marginBottom: 24 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 52, marginBottom: 14 }}>🎉</div>
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, fontWeight: 700, color: GREEN, marginBottom: 8 }}>
            Your marae is set up. Welcome to MaraeHub.
          </div>
          <div style={{ fontSize: 14, color: TEXT3 }}>
            You're all set to manage your marae from one place.
          </div>
        </div>

        <div style={{ background: CREAM, borderRadius: 10, padding: '20px 24px', marginBottom: 28 }}>
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 15, fontWeight: 700, color: GREEN, marginBottom: 16 }}>
            Your First Week
          </div>
          {weekDays.map(day => (
            <div key={day.label} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: TEXT1, marginBottom: 6 }}>{day.label}</div>
              <ol style={{ margin: 0, paddingLeft: 20 }}>
                {day.steps.map(s => (
                  <li key={s} style={{ fontSize: 13, color: TEXT3, lineHeight: 1.7 }}>{s}</li>
                ))}
              </ol>
            </div>
          ))}
          <div style={{ marginTop: 4, paddingTop: 14, borderTop: `1px solid ${BORDER}` }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: TEXT1, marginBottom: 4 }}>Then — invite your trustees</div>
            <div style={{ fontSize: 13, color: TEXT3 }}>Settings → Trustees → invite your team</div>
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <button
            onClick={() => { setHidden(true); onComplete?.(); }}
            style={{ padding: '11px 32px', background: GREEN, color: WHITE, border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
          >
            Go to Board View →
          </button>
        </div>
      </div>
    );
  }

  const completedSteps = step - 1;

  return (
    <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '28px 32px', marginBottom: 24 }}>

      {/* ── PROGRESS ─────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontFamily: 'Playfair Display, serif', fontSize: 13, fontWeight: 700, color: TEXT3, textTransform: 'uppercase', letterSpacing: 1 }}>
            Marae Setup — Step {step} of 5
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            {STEPS.map(s => (
              <div key={s.num} style={{
                width: 26, height: 26, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700,
                background: s.num < step ? GREEN : s.num === step ? GREEN : CREAM,
                color:      s.num <= step ? WHITE : TEXT3,
                border:     `2px solid ${s.num <= step ? GREEN : BORDER}`,
                transition: 'all 0.3s',
              }}>
                {s.num < step ? '✓' : s.num}
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: CREAM, borderRadius: 8, height: 6, overflow: 'hidden' }}>
          <div style={{ width: `${(completedSteps / 5) * 100}%`, height: '100%', background: GREEN, borderRadius: 8, transition: 'width 0.4s ease' }} />
        </div>
      </div>

      {/* ── STEP HEADER ──────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontFamily: 'Playfair Display, serif', fontWeight: 700, color: TEXT1 }}>
          {STEPS[step - 1].icon} {STEPS[step - 1].title}
        </div>
        <div style={{ fontSize: 13, color: TEXT3, marginTop: 4 }}>{STEPS[step - 1].sub}</div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      {/* ── STEP 1: Your Marae ───────────────────────────────────────────── */}
      {step === 1 && (
        <div>
          <div className="form-group">
            <label className="form-label">Marae Name *</label>
            <input className="form-input" value={maraeName} onChange={e => setMaraeName(e.target.value)} placeholder="e.g. Te Marae o Tainui" />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Location</label>
              <input className="form-input" value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Manurewa, Auckland" />
            </div>
            <div className="form-group">
              <label className="form-label">Iwi</label>
              <input className="form-input" value={iwi} onChange={e => setIwi(e.target.value)} placeholder="e.g. Tainui" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Hapū</label>
            <input className="form-input" value={hapu} onChange={e => setHapu(e.target.value)} placeholder="e.g. Ngāti Mahuta" />
          </div>
          <button className="btn-primary" onClick={saveStep1} disabled={saving}>
            {saving ? 'Saving...' : 'Save & Continue →'}
          </button>
        </div>
      )}

      {/* ── STEP 2: Invite a Trustee ─────────────────────────────────────── */}
      {step === 2 && (
        <div>
          {inviteResult ? (
            <>
              <div className="alert alert-success" style={{ marginBottom: 16 }}>{inviteResult}</div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn-primary" onClick={proceedFromStep2} disabled={saving}>Continue →</button>
              </div>
            </>
          ) : (
            <>
              <div className="form-group">
                <label className="form-label">Email address</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input
                    className="form-input" style={{ flex: 1 }} type="email"
                    value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                    placeholder="trustee@example.com"
                    onKeyDown={e => e.key === 'Enter' && saveStep2(false)}
                  />
                  <button className="btn-primary" onClick={() => saveStep2(false)} disabled={inviting || saving} style={{ flexShrink: 0 }}>
                    {inviting ? 'Sending...' : 'Send Invite'}
                  </button>
                </div>
              </div>
              <button className="btn-secondary" onClick={() => saveStep2(true)} disabled={saving}>
                I'll invite trustees later →
              </button>
            </>
          )}
        </div>
      )}

      {/* ── STEP 3: First Asset ──────────────────────────────────────────── */}
      {step === 3 && (
        <div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Asset Name *</label>
              <input className="form-input" value={assetName} onChange={e => setAssetName(e.target.value)} placeholder="e.g. Wharenui Main Hall" />
            </div>
            <div className="form-group">
              <label className="form-label">Asset Type</label>
              <select className="form-input" value={assetCategory} onChange={e => setAssetCategory(e.target.value)}>
                {ASSET_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Next Service Due</label>
              <input type="date" className="form-input" value={serviceDate} onChange={e => setServiceDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Reminder Type</label>
              <input
                className="form-input" list="ob-service-types"
                value={serviceType} onChange={e => setServiceType(e.target.value)}
                placeholder="e.g. Annual WOF"
              />
              <datalist id="ob-service-types">
                {SERVICE_TYPES.map(t => <option key={t} value={t} />)}
              </datalist>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn-primary" onClick={() => saveStep3(false)} disabled={saving}>
              {saving ? 'Saving...' : 'Add Asset & Continue →'}
            </button>
            <button className="btn-secondary" onClick={() => saveStep3(true)} disabled={saving}>Skip for now</button>
          </div>
        </div>
      )}

      {/* ── STEP 4: Compliance Item ──────────────────────────────────────── */}
      {step === 4 && (
        <div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {QUICK_COMPLIANCE.map(item => (
              <button
                key={item}
                onClick={() => setCompItem(item)}
                style={{
                  padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                  border:      `1.5px solid ${compItem === item ? GREEN : BORDER}`,
                  background:  compItem === item ? '#E6F4F0' : WHITE,
                  color:       compItem === item ? GREEN : TEXT1,
                }}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Or type your own</label>
              <input
                className="form-input"
                value={compItem} onChange={e => setCompItem(e.target.value)}
                placeholder="e.g. Annual Audit"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Due Date</label>
              <input type="date" className="form-input" value={compDue} onChange={e => setCompDue(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn-primary" onClick={() => saveStep4(false)} disabled={saving}>
              {saving ? 'Saving...' : 'Add & Continue →'}
            </button>
            <button className="btn-secondary" onClick={() => saveStep4(true)} disabled={saving}>Skip for now</button>
          </div>
        </div>
      )}

      {/* ── STEP 5: Next Hui ─────────────────────────────────────────────── */}
      {step === 5 && (
        <div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Date *</label>
              <input type="date" className="form-input" value={huiDate} onChange={e => setHuiDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Time (optional)</label>
              <input type="time" className="form-input" value={huiTime} onChange={e => setHuiTime(e.target.value)} />
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Location (optional)</label>
              <input className="form-input" value={huiLocation} onChange={e => setHuiLocation(e.target.value)} placeholder="e.g. Wharenui" />
            </div>
            <div className="form-group">
              <label className="form-label">Notes (optional)</label>
              <input className="form-input" value={huiNotes} onChange={e => setHuiNotes(e.target.value)} placeholder="e.g. Bring AGM agenda" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn-primary" onClick={() => saveStep5(false)} disabled={saving}>
              {saving ? 'Saving...' : 'Schedule Hui & Finish →'}
            </button>
            <button className="btn-secondary" onClick={() => saveStep5(true)} disabled={saving}>Skip for now</button>
          </div>
        </div>
      )}

      {/* ── SKIP ALL ─────────────────────────────────────────────────────── */}
      <div style={{ marginTop: 24, paddingTop: 16, borderTop: `1px solid ${BORDER}`, textAlign: 'center' }}>
        <button
          onClick={skipAll}
          style={{ background: 'none', border: 'none', color: TEXT3, fontSize: 12, cursor: 'pointer', textDecoration: 'underline', fontFamily: 'DM Sans, sans-serif' }}
        >
          Skip setup — I'll explore on my own
        </button>
      </div>

    </div>
  );
}
