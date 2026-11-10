import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { logAudit } from '../lib/audit';
import FormError from './FormError';

// Building Plan: upload a picture of a floor plan, drop pins on it for the things
// people need to find fast in an emergency. Pins are saved as a percentage of the
// picture so they stay in place on any screen. The picture is shrunk before upload
// so a plan costs well under 1 MB of the marae's storage allowance.

const BUCKET = 'emergency-response-evidence';
const MAX_SIDE = 2000;

export const PIN_TYPES = [
  { value: 'first_aid',         label: 'First aid kit',       icon: '🩹' },
  { value: 'defibrillator',     label: 'Defibrillator (AED)', icon: '❤️' },
  { value: 'fire_extinguisher', label: 'Fire extinguisher',   icon: '🧯' },
  { value: 'fire_alarm',        label: 'Fire alarm panel',    icon: '🚨' },
  { value: 'exit',              label: 'Exit',                icon: '🚪' },
  { value: 'power_shutoff',     label: 'Power shut-off',      icon: '⚡' },
  { value: 'water_shutoff',     label: 'Water shut-off',      icon: '💧' },
  { value: 'gas_shutoff',       label: 'Gas shut-off',        icon: '🔥' },
  { value: 'assembly_point',    label: 'Assembly point',      icon: '📍' },
  { value: 'torch_radio',       label: 'Torch / radio',       icon: '🔦' },
  { value: 'other',             label: 'Other',               icon: '📌' },
];
const pinMeta = t => PIN_TYPES.find(p => p.value === t) || PIN_TYPES[PIN_TYPES.length - 1];

const EMPTY_PIN_FORM = { pin_type: 'first_aid', label: '', notes: '' };

// Shrink a picture so the longest side is at most MAX_SIDE and save as JPEG.
async function shrinkImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('That file could not be read as a picture.'));
      i.src = url;
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.85));
    if (!blob) throw new Error('Could not prepare the picture. Try a different file.');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function BuildingPlans({ entities = [] }) {
  const [plans, setPlans] = useState([]);
  const [pins, setPins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const [imageError, setImageError] = useState('');

  const [showUpload, setShowUpload] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadEntity, setUploadEntity] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const [placing, setPlacing] = useState(false);        // waiting for a tap on the plan
  const [movingPinId, setMovingPinId] = useState(null); // re-placing an existing pin
  const [pendingSpot, setPendingSpot] = useState(null); // {x, y} for a new pin
  const [editPin, setEditPin] = useState(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinForm, setPinForm] = useState(EMPTY_PIN_FORM);
  const [pinSaving, setPinSaving] = useState(false);
  const [pinError, setPinError] = useState('');
  const [activePinId, setActivePinId] = useState(null);
  const imgRef = useRef(null);

  useEffect(() => { fetchAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchAll() {
    setLoading(true);
    const [plansRes, pinsRes] = await Promise.all([
      supabase.from('emergency_building_plans').select('*').order('created_at'),
      supabase.from('emergency_plan_pins').select('*').order('created_at'),
    ]);
    if (plansRes.error || pinsRes.error) {
      setLoadError('Could not load the building plans. Please refresh and try again.');
    } else {
      setLoadError('');
      setPlans(plansRes.data || []);
      setPins(pinsRes.data || []);
      setSelectedId(cur => (plansRes.data || []).some(p => p.id === cur) ? cur : (plansRes.data?.[0]?.id || null));
    }
    setLoading(false);
  }

  const selectedPlan = plans.find(p => p.id === selectedId) || null;
  const planPins = pins.filter(p => p.plan_id === selectedId);

  // Private bucket: make a fresh signed link whenever the chosen plan changes.
  useEffect(() => {
    let cancelled = false;
    setImageUrl(''); setImageError('');
    if (!selectedPlan) return undefined;
    supabase.storage.from(BUCKET).createSignedUrl(selectedPlan.image_path, 3600).then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data?.signedUrl) setImageError('Could not load the plan picture. Try refreshing, or upload it again.');
      else setImageUrl(data.signedUrl);
    });
    return () => { cancelled = true; };
  }, [selectedPlan?.id, selectedPlan?.image_path]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Upload a plan ───────────────────────────────────────────────────────
  async function handleUpload() {
    if (!uploadName.trim()) { setUploadError('Give the plan a name, e.g. "Wharenui" or "Wharekai".'); return; }
    if (!uploadFile) { setUploadError('Choose a picture of the plan.'); return; }
    if (!uploadFile.type.startsWith('image/')) {
      setUploadError('Please choose a picture (JPG or PNG). For a PDF plan, take a screenshot of it and upload that.');
      return;
    }
    setUploading(true); setUploadError('');
    try {
      const blob = await shrinkImage(uploadFile);
      const path = `plans/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' });
      if (upErr) throw new Error('The picture could not be saved. Please try again.');
      const entity_id = uploadEntity || (entities.length === 1 ? entities[0].id : null);
      const { data, error } = await supabase.from('emergency_building_plans')
        .insert({ name: uploadName.trim(), image_path: path, entity_id }).select().single();
      if (error) {
        await supabase.storage.from(BUCKET).remove([path]);
        throw new Error(error.message);
      }
      logAudit({ entityId: entity_id, action: 'create', resourceType: 'building_plan', resourceId: data.id, resourceName: data.name });
      await fetchAll();
      setSelectedId(data.id);
      setShowUpload(false); setUploadName(''); setUploadFile(null); setUploadEntity('');
    } catch (e) {
      setUploadError(e.message);
    }
    setUploading(false);
  }

  async function deletePlan() {
    if (!selectedPlan) return;
    if (!window.confirm(`Delete the plan "${selectedPlan.name}" and all ${planPins.length} pins on it? This cannot be undone.`)) return;
    const { error } = await supabase.from('emergency_building_plans').delete().eq('id', selectedPlan.id);
    if (error) { setLoadError(error.message); return; }
    await supabase.storage.from(BUCKET).remove([selectedPlan.image_path]);
    logAudit({ entityId: selectedPlan.entity_id, action: 'delete', resourceType: 'building_plan', resourceId: selectedPlan.id, resourceName: selectedPlan.name });
    setSelectedId(null);
    await fetchAll();
  }

  // ── Pins ────────────────────────────────────────────────────────────────
  function spotFromClick(e) {
    const rect = imgRef.current.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));
    return { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 };
  }

  async function handlePlanClick(e) {
    if (movingPinId) {
      const { x, y } = spotFromClick(e);
      const { error } = await supabase.from('emergency_plan_pins').update({ x_pct: x, y_pct: y }).eq('id', movingPinId);
      if (error) setLoadError(error.message);
      setMovingPinId(null);
      await fetchAll();
      return;
    }
    if (!placing) { setActivePinId(null); return; }
    setPendingSpot(spotFromClick(e));
    setPlacing(false);
    setEditPin(null);
    setPinForm(EMPTY_PIN_FORM);
    setPinError('');
    setShowPinModal(true);
  }

  function openEditPin(pin) {
    setEditPin(pin);
    setPendingSpot(null);
    setPinForm({ pin_type: pin.pin_type, label: pin.label, notes: pin.notes || '' });
    setPinError('');
    setShowPinModal(true);
  }

  async function handleSavePin() {
    if (!pinForm.label.trim()) { setPinError('Say where it is or what it is, e.g. "Kitchen, by the back door".'); return; }
    setPinSaving(true); setPinError('');
    const base = { pin_type: pinForm.pin_type, label: pinForm.label.trim(), notes: pinForm.notes.trim() || null };
    const { error } = editPin
      ? await supabase.from('emergency_plan_pins').update(base).eq('id', editPin.id)
      : await supabase.from('emergency_plan_pins').insert({ ...base, plan_id: selectedId, x_pct: pendingSpot.x, y_pct: pendingSpot.y });
    if (error) { setPinError(error.message); setPinSaving(false); return; }
    logAudit({
      entityId: selectedPlan?.entity_id,
      action: editPin ? 'update' : 'create',
      resourceType: 'building_plan_pin',
      resourceId: editPin?.id,
      resourceName: base.label,
    });
    await fetchAll();
    setShowPinModal(false);
    setPinSaving(false);
  }

  async function deletePin(pin) {
    if (!window.confirm(`Remove the pin "${pin.label}"?`)) return;
    await supabase.from('emergency_plan_pins').delete().eq('id', pin.id);
    logAudit({ entityId: selectedPlan?.entity_id, action: 'delete', resourceType: 'building_plan_pin', resourceId: pin.id, resourceName: pin.label });
    setActivePinId(null);
    await fetchAll();
  }

  // ── Print ───────────────────────────────────────────────────────────────
  function printPlan() {
    if (!selectedPlan || !imageUrl) return;
    const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const markers = planPins.map((p, i) =>
      `<div class="pin" style="left:${p.x_pct}%;top:${p.y_pct}%">${i + 1}</div>`).join('');
    const legend = planPins.map((p, i) =>
      `<tr><td class="n">${i + 1}</td><td>${pinMeta(p.pin_type).icon} ${esc(pinMeta(p.pin_type).label)}</td><td>${esc(p.label)}${p.notes ? ` — <em>${esc(p.notes)}</em>` : ''}</td></tr>`).join('');
    const w = window.open('', '_blank');
    if (!w) { setLoadError('Your browser blocked the print window. Allow pop-ups for this site and try again.'); return; }
    w.document.write(`<!doctype html><html><head><title>${esc(selectedPlan.name)} — Building Plan</title>
<style>
body{font-family:Arial,sans-serif;margin:24px;color:#222}
h1{font-size:20px;margin:0 0 4px} .sub{color:#666;font-size:12px;margin-bottom:12px}
.wrap{position:relative;display:inline-block;max-width:100%}
.wrap img{display:block;max-width:100%;max-height:640px}
.pin{position:absolute;transform:translate(-50%,-50%);width:22px;height:22px;border-radius:50%;background:#c0392b;color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 0 0 1px #c0392b}
table{border-collapse:collapse;margin-top:16px;width:100%;font-size:13px} td{border-bottom:1px solid #ddd;padding:6px 8px;vertical-align:top} td.n{font-weight:700;width:28px}
.note{margin-top:14px;font-size:11px;color:#777}
</style></head><body>
<h1>${esc(selectedPlan.name)}</h1>
<div class="sub">Building plan — printed ${new Date().toLocaleDateString('en-NZ')}</div>
<div class="wrap"><img id="plan" src="${imageUrl}" alt="Building plan">${markers}</div>
<table>${legend || '<tr><td>No pins placed yet.</td></tr>'}</table>
<div class="note">Not to scale. Check the real locations during your regular walk-through.</div>
<script>var i=document.getElementById('plan');function go(){setTimeout(function(){window.print()},300)}if(i.complete)go();else i.onload=go;</script>
</body></html>`);
    w.document.close();
  }

  // ── Render ──────────────────────────────────────────────────────────────
  if (loading) return <div style={{ color: 'var(--text3)', fontSize: 14 }}>Loading...</div>;

  const activePin = planPins.find(p => p.id === activePinId) || null;
  const cursor = (placing || movingPinId) ? 'crosshair' : 'default';

  return (
    <div>
      <div style={{ fontSize: 14, color: 'var(--text3)', maxWidth: 640, marginBottom: 16 }}>
        Upload a picture of your floor plan (a scan, photo or screenshot), then drop pins where people need to find things fast — first aid, fire gear, shut-offs and exits. Shown as a drawing only, not to scale.
      </div>
      <FormError message={loadError} />

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        {plans.map(p => (
          <button key={p.id} onClick={() => { setSelectedId(p.id); setPlacing(false); setMovingPinId(null); setActivePinId(null); }}
            className={p.id === selectedId ? 'btn-primary' : 'btn-secondary'} style={{ fontSize: 13 }}>
            {p.name}
          </button>
        ))}
        <button className="btn-secondary" style={{ fontSize: 13 }} onClick={() => { setUploadError(''); setShowUpload(true); }}>
          + Upload a plan
        </button>
      </div>

      {plans.length === 0 && (
        <div className="panel" style={{ padding: '24px 20px', textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>
          No plan uploaded yet. Take a photo of your floor plan, or screenshot a PDF of it, and upload it. If you don't have one, a hand-drawn sketch photographed from above works fine.
        </div>
      )}

      {selectedPlan && (
        <div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <button className="btn-primary" style={{ fontSize: 13 }} onClick={() => { setPlacing(true); setMovingPinId(null); setActivePinId(null); }} disabled={!imageUrl || placing}>
              📍 Add a pin
            </button>
            <button className="btn-secondary" style={{ fontSize: 13 }} onClick={printPlan} disabled={!imageUrl}>🖨️ Print plan</button>
            <button className="btn-secondary" style={{ fontSize: 13, color: 'var(--danger)' }} onClick={deletePlan}>Delete plan</button>
          </div>

          {(placing || movingPinId) && (
            <div style={{ background: '#FDF3E3', border: '1px solid #e8cf9f', borderRadius: 8, padding: '8px 12px', fontSize: 13, marginBottom: 10, display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <span>{movingPinId ? 'Tap the new spot for this pin.' : 'Tap the plan where the pin should go.'}</span>
              <button onClick={() => { setPlacing(false); setMovingPinId(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brand)', fontWeight: 600 }}>Cancel</button>
            </div>
          )}

          <FormError message={imageError} />
          {imageUrl && (
            <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
              <img ref={imgRef} src={imageUrl} alt={`Plan of ${selectedPlan.name}`} onClick={handlePlanClick}
                style={{ display: 'block', maxWidth: '100%', maxHeight: '70vh', cursor, userSelect: 'none' }} draggable={false} />
              {planPins.map(p => (
                <button key={p.id} title={`${pinMeta(p.pin_type).label}: ${p.label}`}
                  onClick={e => { e.stopPropagation(); if (!placing && !movingPinId) setActivePinId(p.id === activePinId ? null : p.id); }}
                  style={{
                    position: 'absolute', left: `${p.x_pct}%`, top: `${p.y_pct}%`, transform: 'translate(-50%, -50%)',
                    width: 30, height: 30, borderRadius: '50%', border: p.id === activePinId ? '3px solid var(--brand)' : '2px solid #fff',
                    background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.4)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0,
                    opacity: movingPinId === p.id ? 0.4 : 1,
                  }}>
                  {pinMeta(p.pin_type).icon}
                </button>
              ))}
            </div>
          )}

          {activePin && (
            <div className="panel" style={{ padding: '12px 16px', marginTop: 12, maxWidth: 520 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{pinMeta(activePin.pin_type).icon} {pinMeta(activePin.pin_type).label}</div>
              <div style={{ fontSize: 14, marginTop: 2 }}>{activePin.label}</div>
              {activePin.notes && <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>{activePin.notes}</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => openEditPin(activePin)}>Edit</button>
                <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => { setMovingPinId(activePin.id); setActivePinId(null); }}>Move</button>
                <button className="btn-secondary" style={{ fontSize: 12, color: 'var(--danger)' }} onClick={() => deletePin(activePin)}>Remove</button>
              </div>
            </div>
          )}

          {planPins.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Pins on this plan ({planPins.length})</div>
              {planPins.map(p => (
                <div key={p.id} onClick={() => setActivePinId(p.id)} style={{ fontSize: 14, padding: '6px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
                  {pinMeta(p.pin_type).icon} <strong>{pinMeta(p.pin_type).label}</strong> — {p.label}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── UPLOAD MODAL ─────────────────────────────────────────────────── */}
      {showUpload && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' }}>
          <div style={{ background: 'var(--surface)', borderRadius: 14, width: '100%', maxWidth: 480, padding: 28, boxShadow: '0 8px 40px rgba(0,0,0,0.22)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, margin: 0, color: 'var(--brand)' }}>Upload a plan</h2>
              <button onClick={() => setShowUpload(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text3)', lineHeight: 1 }}>✕</button>
            </div>
            <FormError message={uploadError} />
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input className="form-input" value={uploadName} onChange={e => setUploadName(e.target.value)} placeholder="e.g. Wharenui, Wharekai, Whole site" />
            </div>
            <div className="form-group">
              <label className="form-label">Picture of the plan *</label>
              <input type="file" accept="image/*" onChange={e => setUploadFile(e.target.files?.[0] || null)} />
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>JPG or PNG. It is shrunk automatically so it uses very little storage.</div>
            </div>
            {entities.length > 1 && (
              <div className="form-group">
                <label className="form-label">Entity</label>
                <select className="form-input" value={uploadEntity} onChange={e => setUploadEntity(e.target.value)}>
                  <option value="">— Shared (all entities) —</option>
                  {entities.map(ent => <option key={ent.id} value={ent.id}>{ent.name}</option>)}
                </select>
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowUpload(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleUpload} className="btn-primary" disabled={uploading}>{uploading ? 'Uploading...' : 'Upload'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── PIN MODAL ────────────────────────────────────────────────────── */}
      {showPinModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' }}>
          <div style={{ background: 'var(--surface)', borderRadius: 14, width: '100%', maxWidth: 440, padding: 28, boxShadow: '0 8px 40px rgba(0,0,0,0.22)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, margin: 0, color: 'var(--brand)' }}>{editPin ? 'Edit pin' : 'New pin'}</h2>
              <button onClick={() => setShowPinModal(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text3)', lineHeight: 1 }}>✕</button>
            </div>
            <FormError message={pinError} />
            <div className="form-group">
              <label className="form-label">What is it?</label>
              <select className="form-input" value={pinForm.pin_type} onChange={e => setPinForm(f => ({ ...f, pin_type: e.target.value }))}>
                {PIN_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Where / which one? *</label>
              <input className="form-input" value={pinForm.label} onChange={e => setPinForm(f => ({ ...f, label: e.target.value }))} placeholder="e.g. Kitchen, by the back door" />
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-input" rows={2} value={pinForm.notes} onChange={e => setPinForm(f => ({ ...f, notes: e.target.value }))} placeholder="e.g. Key is in the red box" style={{ resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowPinModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSavePin} className="btn-primary" disabled={pinSaving}>{pinSaving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
