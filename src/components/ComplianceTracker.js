import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import useProfiles from '../lib/useProfiles';
import StatusPill from './StatusPill';

const SEVERITY_OPTIONS = ['minor', 'moderate', 'serious', 'critical'];

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const CATEGORIES = {
  building:                { label: 'Building',                icon: '🏛️', color: '#1a4a8a', bg: '#e8eef8' },
  insurance:               { label: 'Insurance',               icon: '🛡️', color: '#6b42a8', bg: '#f0ecf8' },
  trustee:                 { label: 'Trustee',                 icon: '👥', color: '#1a4a3a', bg: '#e8f4ef' },
  health_safety:           { label: 'Health & Safety',         icon: '⛑️', color: '#a63020', bg: '#faeae7' },
  civil_defence:           { label: 'Civil Defence',           icon: '🚨', color: '#7a4f00', bg: '#fdf0dc' },
  emergency_preparedness:  { label: 'Emergency Preparedness',  icon: '🆘', color: '#8b0000', bg: '#fce8e8' },
  other:                   { label: 'Other',                   icon: '📋', color: '#4a4438', bg: '#f5f0e8' },
};

const EP_SEED_ITEMS = [
  { name: 'Civil Defence Emergency Plan — reviewed and up to date',                    renewal_months: 12, notes: 'Must align with local Civil Defence Group plan. Review after any civil defence exercise or event.' },
  { name: 'Emergency contact list — trustees, key community members, Civil Defence coordinator', renewal_months: 6, notes: 'Include cell numbers, alternative contacts, and local Civil Defence coordinator details.' },
  { name: 'Generator — tested, fuelled, serviced',                                     renewal_months: 3,  notes: 'Test under load monthly. Fuel stabiliser if stored long-term. Log every test run.' },
  { name: 'Water supply — 10,000L tank or alternative checked',                        renewal_months: 6,  notes: 'Inspect tank for leaks, contamination, and pump operation. Confirm potability.' },
  { name: 'Emergency food and supply kit — stocked and checked',                       renewal_months: 6,  notes: 'Check expiry dates on food and medications. Minimum 72-hour supply for likely occupancy.' },
  { name: 'Community welfare register — vulnerable whānau who need checking on',       renewal_months: 12, notes: 'List of kaumātua, disabled whānau, and others who may need welfare checks. Keep private and current.' },
  { name: 'First aid kit — stocked and in date',                                       renewal_months: 6,  notes: 'Check all consumables for expiry. Restock after any use. Ensure AED pads/battery checked if applicable.' },
  { name: 'Evacuation routes — identified and communicated to committee',              renewal_months: 12, notes: 'Post maps in the marae. Brief all trustees and key volunteers. Include accessibility routes.' },
  { name: 'Emergency communications plan — contact community if power/internet down',  renewal_months: 12, notes: 'Document the plan: phone trees, community radio channel, meeting point. Test annually.' },
  { name: 'Marae structure — roof, walls, foundations checked for storm readiness',    renewal_months: 6,  notes: 'Visual inspection after major weather events. Engage qualified builder for structural assessment annually.' },
];

const STATUS_CFG = {
  overdue:   { bg: '#faeae7', color: 'var(--danger)', border: '#f0b8b0', label: 'Overdue',   dot: '#d9534f' },
  due_soon:  { bg: '#fdf0dc', color: '#7a4f00',       border: '#e8c880', label: 'Due Soon',  dot: '#c8902a' },
  compliant: { bg: '#e8f4ef', color: '#1a4a3a',       border: '#a8d8c0', label: 'Compliant', dot: '#2e7d52' },
  not_set:   { bg: '#f5f0e8', color: '#6b6058',       border: '#d9d2c8', label: 'Not Set',   dot: '#9a9088' },
};

const SEVERITY_CFG = {
  minor:    { bg: '#f5f0e8', color: '#6b6058' },
  moderate: { bg: '#fdf0dc', color: '#7a4f00' },
  serious:  { bg: '#faeae7', color: '#a63020' },
  critical: { bg: '#faeae7', color: 'var(--danger)' },
};

const STATUS_ORDER = { overdue: 0, due_soon: 1, compliant: 2, not_set: 3 };

const EMPTY_ITEM = {
  category: 'building', name: '', due_date: '', last_checked_date: '',
  renewal_months: 12, responsible_name: '', notes: '',
};

const EMPTY_INCIDENT = {
  incident_date: new Date().toISOString().split('T')[0],
  title: '', description: '', location: '',
  severity: 'minor', people_involved: '',
  responsible_name: '', action_taken: '',
  follow_up_date: '', resolved: false,
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function fmt(d) {
  if (!d) return '—';
  return new Date(d + 'T12:00:00').toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getStatus(dueDate) {
  if (!dueDate) return 'not_set';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + 'T12:00:00');
  const in30 = new Date(today); in30.setDate(in30.getDate() + 30);
  if (due < today) return 'overdue';
  if (due <= in30) return 'due_soon';
  return 'compliant';
}

function daysLabel(dueDate) {
  if (!dueDate) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = Math.ceil((new Date(dueDate + 'T12:00:00') - today) / 86400000);
  if (days < 0)  return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `${days}d remaining`;
}

function nextDueDate(months) {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function ComplianceTracker() {
  const profiles = useProfiles();
  const trustees = profiles.filter(p => p.role === 'trustee');

  const [items, setItems]       = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [section, setSection]   = useState('items');
  const [catFilter, setCatFilter] = useState('all');

  // Item modal
  const [showItemModal, setShowItemModal] = useState(false);
  const [editItem, setEditItem]   = useState(null);
  const [itemForm, setItemForm]   = useState(EMPTY_ITEM);
  const [itemFile, setItemFile]   = useState(null);
  const [itemSaving, setItemSaving] = useState(false);
  const [itemError, setItemError] = useState('');
  const itemFileRef = useRef();

  // Incident modal
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [editIncident, setEditIncident] = useState(null);
  const [incidentForm, setIncidentForm] = useState(EMPTY_INCIDENT);
  const [incidentFile, setIncidentFile]   = useState(null);
  const [incidentSaving, setIncidentSaving] = useState(false);
  const [incidentError, setIncidentError]   = useState('');
  const incidentFileRef = useRef();

  useEffect(() => {
    fetchAll().then(async items => {
      await seedEmergencyPreparedness(items);
      await createOverdueTasks(items);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchAll() {
    setLoading(true);
    const [itemsRes, incRes] = await Promise.all([
      supabase.from('compliance_items').select('*').order('due_date', { ascending: true, nullsFirst: false }),
      supabase.from('incidents').select('*').order('incident_date', { ascending: false }),
    ]);
    const allItems = itemsRes.data || [];
    setItems(allItems);
    setIncidents(incRes.data || []);
    setLoading(false);
    return allItems;
  }

  async function seedEmergencyPreparedness(currentItems) {
    const hasEP = currentItems.some(i => i.category === 'emergency_preparedness');
    if (hasEP) return;
    const rows = EP_SEED_ITEMS.map(item => ({
      category: 'emergency_preparedness',
      name: item.name,
      renewal_months: item.renewal_months,
      notes: item.notes,
    }));
    const { error } = await supabase.from('compliance_items').insert(rows);
    if (!error) {
      const { data } = await supabase.from('compliance_items').select('*').order('due_date', { ascending: true, nullsFirst: false });
      if (data) setItems(data);
    }
  }

  // Mark a compliance item as done/serviced today.
  // Sets last_checked_date = today; if renewal_months is set, auto-advances due_date.
  async function handleMarkDone(item) {
    const todayStr = new Date().toISOString().split('T')[0];
    const updates = { last_checked_date: todayStr, updated_at: new Date().toISOString() };
    if (item.renewal_months) {
      updates.due_date = nextDueDate(item.renewal_months);
    }
    const { error } = await supabase.from('compliance_items').update(updates).eq('id', item.id);
    if (!error) setItems(prev => prev.map(i => i.id === item.id ? { ...i, ...updates } : i));
  }

  // Auto-create a High-priority task for every overdue compliance item
  // that doesn't already have an open/in-progress OVERDUE: task.
  async function createOverdueTasks(currentItems) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayStr = new Date().toISOString().split('T')[0];
    const overdueItems = currentItems.filter(
      i => i.due_date && new Date(i.due_date + 'T12:00:00') < today
    );
    if (overdueItems.length === 0) return;

    const expectedTitles = overdueItems.map(i => `OVERDUE: ${i.name}`);
    const { data: existing } = await supabase
      .from('tasks')
      .select('title')
      .in('title', expectedTitles)
      .in('status', ['open', 'in-progress']);

    const existingSet = new Set((existing || []).map(t => t.title));
    const newTasks = overdueItems
      .filter(i => !existingSet.has(`OVERDUE: ${i.name}`))
      .map(i => ({
        title: `OVERDUE: ${i.name}`,
        description: `Compliance item overdue. Category: ${CATEGORIES[i.category]?.label || i.category}. Please arrange renewal immediately.`,
        assigned_to: i.responsible_name || null,
        due_date: todayStr,
        priority: 'High',
        status: 'open',
      }));

    if (newTasks.length > 0) {
      await supabase.from('tasks').insert(newTasks);
    }
  }

  // ── DOCUMENT UPLOAD ────────────────────────────────────────────────────────

  async function uploadDoc(file, prefix) {
    const path = `${prefix}/${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
    const { error } = await supabase.storage.from('compliance-docs').upload(path, file);
    if (error) {
      console.warn('[ComplianceTracker] storage upload failed:', error.message);
      return { url: null, name: file.name };
    }
    const { data } = supabase.storage.from('compliance-docs').getPublicUrl(path);
    return { url: data?.publicUrl || null, name: file.name };
  }

  // ── ITEM CRUD ──────────────────────────────────────────────────────────────

  function openAddItem() {
    setEditItem(null); setItemForm(EMPTY_ITEM);
    setItemFile(null); setItemError(''); setShowItemModal(true);
  }

  function openEditItem(item) {
    setEditItem(item);
    setItemForm({
      category: item.category || 'building',
      name: item.name || '',
      due_date: item.due_date || '',
      last_checked_date: item.last_checked_date || '',
      renewal_months: item.renewal_months ?? 12,
      responsible_name: item.responsible_name || '',
      notes: item.notes || '',
    });
    setItemFile(null); setItemError(''); setShowItemModal(true);
  }

  async function handleSaveItem() {
    if (!itemForm.name.trim()) { setItemError('Name is required.'); return; }
    setItemSaving(true); setItemError('');

    let document_url = editItem?.document_url ?? null;
    let document_name = editItem?.document_name ?? null;
    if (itemFile) {
      const { url, name } = await uploadDoc(itemFile, 'items');
      if (url) { document_url = url; document_name = name; }
    }

    const payload = {
      category: itemForm.category,
      name: itemForm.name.trim(),
      due_date: itemForm.due_date || null,
      last_checked_date: itemForm.last_checked_date || null,
      renewal_months: itemForm.renewal_months ? Number(itemForm.renewal_months) : null,
      responsible_name: itemForm.responsible_name || null,
      notes: itemForm.notes.trim() || null,
      document_url, document_name,
      updated_at: new Date().toISOString(),
    };

    if (editItem) {
      const { error } = await supabase.from('compliance_items').update(payload).eq('id', editItem.id);
      if (error) { setItemError(error.message); setItemSaving(false); return; }
    } else {
      const { error } = await supabase.from('compliance_items').insert(payload);
      if (error) { setItemError(error.message); setItemSaving(false); return; }
    }
    await fetchAll();
    setShowItemModal(false);
    setItemSaving(false);
  }

  async function deleteItem(id) {
    if (!window.confirm('Delete this compliance item?')) return;
    await supabase.from('compliance_items').delete().eq('id', id);
    setItems(prev => prev.filter(i => i.id !== id));
  }

  // ── INCIDENT CRUD ──────────────────────────────────────────────────────────

  function openAddIncident() {
    setEditIncident(null); setIncidentForm(EMPTY_INCIDENT);
    setIncidentFile(null); setIncidentError(''); setShowIncidentModal(true);
  }

  function openEditIncident(inc) {
    setEditIncident(inc);
    setIncidentForm({
      incident_date: inc.incident_date || '',
      title: inc.title || '',
      description: inc.description || '',
      location: inc.location || '',
      severity: inc.severity || 'minor',
      people_involved: inc.people_involved || '',
      responsible_name: inc.responsible_name || '',
      action_taken: inc.action_taken || '',
      follow_up_date: inc.follow_up_date || '',
      resolved: inc.resolved || false,
    });
    setIncidentFile(null); setIncidentError(''); setShowIncidentModal(true);
  }

  async function handleSaveIncident() {
    if (!incidentForm.title.trim()) { setIncidentError('Title is required.'); return; }
    if (!incidentForm.incident_date) { setIncidentError('Date is required.'); return; }
    setIncidentSaving(true); setIncidentError('');

    let document_url = editIncident?.document_url ?? null;
    let document_name = editIncident?.document_name ?? null;
    if (incidentFile) {
      const { url, name } = await uploadDoc(incidentFile, 'incidents');
      if (url) { document_url = url; document_name = name; }
    }

    const payload = {
      incident_date: incidentForm.incident_date,
      title: incidentForm.title.trim(),
      description: incidentForm.description.trim() || null,
      location: incidentForm.location.trim() || null,
      severity: incidentForm.severity,
      people_involved: incidentForm.people_involved.trim() || null,
      responsible_name: incidentForm.responsible_name || null,
      action_taken: incidentForm.action_taken.trim() || null,
      follow_up_date: incidentForm.follow_up_date || null,
      resolved: incidentForm.resolved,
      document_url, document_name,
    };

    if (editIncident) {
      const { error } = await supabase.from('incidents').update(payload).eq('id', editIncident.id);
      if (error) { setIncidentError(error.message); setIncidentSaving(false); return; }
    } else {
      const { error } = await supabase.from('incidents').insert(payload);
      if (error) { setIncidentError(error.message); setIncidentSaving(false); return; }
    }
    await fetchAll();
    setShowIncidentModal(false);
    setIncidentSaving(false);
  }

  async function deleteIncident(id) {
    if (!window.confirm('Delete this incident record?')) return;
    await supabase.from('incidents').delete().eq('id', id);
    setIncidents(prev => prev.filter(i => i.id !== id));
  }

  async function toggleResolved(inc) {
    await supabase.from('incidents').update({ resolved: !inc.resolved }).eq('id', inc.id);
    setIncidents(prev => prev.map(i => i.id === inc.id ? { ...i, resolved: !i.resolved } : i));
  }

  async function handleSeverityChange(id, severity) {
    await supabase.from('incidents').update({ severity }).eq('id', id);
    setIncidents(prev => prev.map(i => i.id === id ? { ...i, severity } : i));
  }

  // ── COMPUTED ───────────────────────────────────────────────────────────────

  const counts = { overdue: 0, due_soon: 0, compliant: 0, not_set: 0 };
  items.forEach(item => counts[getStatus(item.due_date)]++);

  const epItems = items.filter(i => i.category === 'emergency_preparedness');
  const epOverdue  = epItems.filter(i => getStatus(i.due_date) === 'overdue');
  const epNotSet   = epItems.filter(i => getStatus(i.due_date) === 'not_set');
  const epAlert    = epOverdue.length + epNotSet.length;

  const filteredItems = (catFilter === 'all' ? items : items.filter(i => i.category === catFilter))
    .slice()
    .sort((a, b) => {
      const sa = STATUS_ORDER[getStatus(a.due_date)];
      const sb = STATUS_ORDER[getStatus(b.due_date)];
      if (sa !== sb) return sa - sb;
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date) - new Date(b.due_date);
    });

  if (loading) return <div className="loading">Loading compliance data...</div>;

  // ── RENDER ────────────────────────────────────────────────────────────────

  return (
    <div>

      {/* ── SUMMARY BAR ──────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { key: 'overdue',   label: 'Overdue',   icon: '🔴' },
          { key: 'due_soon',  label: 'Due Soon',  icon: '🟡' },
          { key: 'compliant', label: 'Compliant', icon: '🟢' },
          { key: 'not_set',   label: 'Not Set',   icon: '—'  },
        ].map(s => {
          const cfg = STATUS_CFG[s.key];
          const n = counts[s.key];
          return (
            <div
              key={s.key}
              className="panel"
              style={{ textAlign: 'center', padding: '14px 10px', cursor: 'pointer', borderLeft: `4px solid ${cfg.dot}` }}
              onClick={() => { setSection('items'); setCatFilter('all'); }}
            >
              <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 28, fontWeight: 700, color: n > 0 && s.key !== 'compliant' && s.key !== 'not_set' ? cfg.color : 'var(--text1)', lineHeight: 1, marginBottom: 4 }}>{n}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500 }}>{s.label}</div>
            </div>
          );
        })}
      </div>

      {/* ── EMERGENCY PREPAREDNESS ALERT ─────────────────────────────────── */}
      {epItems.length > 0 && epAlert > 0 && (
        <div
          style={{
            background: '#fce8e8', border: '1px solid #f5b8b8', borderLeft: '4px solid #8b0000',
            borderRadius: 8, padding: '12px 16px', marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
          }}
          onClick={() => { setSection('items'); setCatFilter('emergency_preparedness'); }}
        >
          <span style={{ fontSize: 18 }}>🆘</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#8b0000' }}>
              Emergency Preparedness — {epAlert} item{epAlert !== 1 ? 's' : ''} need attention
            </div>
            <div style={{ fontSize: 12, color: '#a63020', marginTop: 2 }}>
              {epOverdue.length > 0 && `${epOverdue.length} overdue`}
              {epOverdue.length > 0 && epNotSet.length > 0 && ' · '}
              {epNotSet.length > 0 && `${epNotSet.length} not yet scheduled`}
              {' — click to review'}
            </div>
          </div>
          <span style={{ fontSize: 11, color: '#a63020', opacity: 0.7 }}>→</span>
        </div>
      )}

      {/* ── SECTION TOGGLE ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          {[
            { key: 'items',     label: '📋 Compliance Items' },
            { key: 'incidents', label: '⚠️ Incident Register' },
          ].map((s, i) => (
            <button
              key={s.key}
              onClick={() => setSection(s.key)}
              style={{
                padding: '8px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: section === s.key ? 'var(--brand)' : 'var(--surface)',
                color: section === s.key ? '#fff' : 'var(--text2)',
                border: 'none', borderRight: i === 0 ? '1px solid var(--border)' : 'none',
                fontFamily: 'DM Sans, sans-serif',
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
        {section === 'items' && (
          <button className="btn-primary" onClick={openAddItem} style={{ fontSize: 13 }}>
            + Add Item
          </button>
        )}
        {section === 'incidents' && (
          <button className="btn-primary" onClick={openAddIncident} style={{ fontSize: 13 }}>
            + Log Incident
          </button>
        )}
      </div>

      {/* ── COMPLIANCE ITEMS SECTION ─────────────────────────────────────── */}
      {section === 'items' && (
        <>
          {/* Category filter */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            {[{ key: 'all', label: 'All', icon: '📌' }, ...Object.entries(CATEGORIES).map(([k, v]) => ({ key: k, label: v.label, icon: v.icon }))].map(c => (
              <button
                key={c.key}
                onClick={() => setCatFilter(c.key)}
                style={{
                  padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  borderRadius: 20, border: '1px solid var(--border)',
                  background: catFilter === c.key ? 'var(--brand)' : 'var(--surface)',
                  color: catFilter === c.key ? '#fff' : 'var(--text2)',
                  fontFamily: 'DM Sans, sans-serif',
                }}
              >
                {c.icon} {c.label}
              </button>
            ))}
          </div>

          {/* Items list */}
          {filteredItems.length === 0 ? (
            <div className="empty-state"><div className="emoji">✅</div><div>No compliance items in this category</div></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredItems.map(item => {
                const status = getStatus(item.due_date);
                const scfg = STATUS_CFG[status];
                const cat = CATEGORIES[item.category] || CATEGORIES.other;
                const dl = daysLabel(item.due_date);
                return (
                  <div
                    key={item.id}
                    className="panel"
                    style={{ padding: '14px 16px', borderLeft: `4px solid ${scfg.dot}` }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                      {/* Left: status + name */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                          <StatusPill status={status} />
                          <span style={{ fontSize: 11, fontWeight: 600, background: cat.bg, color: cat.color, borderRadius: 20, padding: '2px 9px' }}>
                            {cat.icon} {cat.label}
                          </span>
                          {dl && (
                            <span style={{ fontSize: 11, color: scfg.color, fontWeight: status !== 'compliant' && status !== 'not_set' ? 700 : 400 }}>
                              {dl}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text1)', marginBottom: 3 }}>{item.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                          {item.due_date && <span>Next due: <strong style={{ color: status === 'overdue' ? 'var(--danger)' : 'var(--text2)' }}>{fmt(item.due_date)}</strong></span>}
                          {item.due_date && item.renewal_months && <span style={{ margin: '0 6px' }}>·</span>}
                          {item.renewal_months && <span>Renews every {item.renewal_months >= 12 ? `${item.renewal_months / 12}yr` : `${item.renewal_months}mo`}</span>}
                          {(item.due_date || item.renewal_months) && item.responsible_name && <span style={{ margin: '0 6px' }}>·</span>}
                          {item.responsible_name && <span>👤 {item.responsible_name}</span>}
                          {item.last_checked_date && (
                            <span style={{ marginLeft: 6 }}>
                              · Last checked: <strong style={{ color: 'var(--text2)' }}>{fmt(item.last_checked_date)}</strong>
                            </span>
                          )}
                        </div>
                        {item.notes && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4, fontStyle: 'italic' }}>{item.notes}</div>}
                      </div>
                      {/* Right: doc + actions */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        {item.document_url && (
                          <a href={item.document_url} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: 12, color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}
                            title={item.document_name || 'View document'}
                          >
                            📎 Doc
                          </a>
                        )}
                        <button
                          onClick={() => handleMarkDone(item)}
                          title={item.renewal_months
                            ? `Mark done today — next due date set to ${nextDueDate(item.renewal_months)}`
                            : 'Mark as checked today'}
                          style={{
                            fontSize: 11, fontWeight: 700,
                            color: '#1a4a3a', background: '#e8f4ef',
                            border: '1px solid #a8d8c0', borderRadius: 6,
                            padding: '4px 10px', cursor: 'pointer',
                          }}
                        >
                          ✓ Done
                        </button>
                        <button
                          onClick={() => openEditItem(item)}
                          style={{ fontSize: 12, color: 'var(--brand)', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontWeight: 600 }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteItem(item.id)}
                          style={{ fontSize: 12, color: 'var(--danger)', background: 'none', border: '1px solid #f0b8b0', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── INCIDENT REGISTER SECTION ────────────────────────────────────── */}
      {section === 'incidents' && (
        <>
          {incidents.length === 0 ? (
            <div className="empty-state"><div className="emoji">📋</div><div>No incidents recorded</div></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {incidents.map(inc => {
                const scfg = SEVERITY_CFG[inc.severity] || SEVERITY_CFG.minor;
                return (
                  <div
                    key={inc.id}
                    className="panel"
                    style={{ padding: '14px 16px', borderLeft: `4px solid ${inc.resolved ? '#2e7d52' : scfg.color}`, opacity: inc.resolved ? 0.8 : 1 }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                          {inc.resolved ? (
                            <StatusPill status="compliant" />
                          ) : (
                            <StatusPill
                              status={inc.severity}
                              options={SEVERITY_OPTIONS}
                              onStatusChange={s => handleSeverityChange(inc.id, s)}
                            />
                          )}
                          <span style={{ fontSize: 12, color: 'var(--text3)' }}>{fmt(inc.incident_date)}</span>
                          {inc.location && <span style={{ fontSize: 12, color: 'var(--text3)' }}>📍 {inc.location}</span>}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text1)', marginBottom: 3 }}>{inc.title}</div>
                        {inc.description && <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 3, lineHeight: 1.5 }}>{inc.description}</div>}
                        <div style={{ fontSize: 12, color: 'var(--text3)', display: 'flex', flexWrap: 'wrap', gap: '0 12px' }}>
                          {inc.people_involved && <span>👥 {inc.people_involved}</span>}
                          {inc.responsible_name && <span>Responsible: {inc.responsible_name}</span>}
                          {inc.follow_up_date && <span>Follow-up: {fmt(inc.follow_up_date)}</span>}
                        </div>
                        {inc.action_taken && (
                          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4, padding: '6px 10px', background: 'var(--surface2)', borderRadius: 6 }}>
                            <strong>Action taken:</strong> {inc.action_taken}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexDirection: 'column' }}>
                        {inc.document_url && (
                          <a href={inc.document_url} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: 12, color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}
                          >
                            📎 Doc
                          </a>
                        )}
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => toggleResolved(inc)}
                            style={{ fontSize: 11, color: inc.resolved ? '#7a4f00' : '#1a4a3a', background: inc.resolved ? '#fdf0dc' : '#e8f4ef', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontWeight: 600 }}
                          >
                            {inc.resolved ? 'Reopen' : 'Resolve'}
                          </button>
                          <button
                            onClick={() => openEditIncident(inc)}
                            style={{ fontSize: 12, color: 'var(--brand)', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontWeight: 600 }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteIncident(inc.id)}
                            style={{ fontSize: 12, color: 'var(--danger)', background: 'none', border: '1px solid #f0b8b0', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── ITEM MODAL ───────────────────────────────────────────────────── */}
      {showItemModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' }}>
          <div style={{ background: 'var(--surface)', borderRadius: 14, width: '100%', maxWidth: 560, padding: 28, boxShadow: '0 8px 40px rgba(0,0,0,0.22)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, margin: 0, color: 'var(--brand)' }}>
                {editItem ? 'Edit Compliance Item' : 'Add Compliance Item'}
              </h2>
              <button onClick={() => setShowItemModal(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text3)', lineHeight: 1 }}>✕</button>
            </div>

            {itemError && <div style={{ background: '#faeae7', border: '1px solid #f0b8b0', borderRadius: 8, padding: '10px 14px', color: 'var(--danger)', fontSize: 13, marginBottom: 14 }}>{itemError}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Category</label>
                <select className="form-input" value={itemForm.category} onChange={e => setItemForm(f => ({ ...f, category: e.target.value }))}>
                  {Object.entries(CATEGORIES).map(([k, v]) => (
                    <option key={k} value={k}>{v.icon} {v.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Name *</label>
                <input className="form-input" value={itemForm.name} onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Building Warrant of Fitness" />
              </div>

              <div className="form-group">
                <label className="form-label">Next Due Date</label>
                <input type="date" className="form-input" value={itemForm.due_date} onChange={e => setItemForm(f => ({ ...f, due_date: e.target.value }))} />
              </div>

              <div className="form-group">
                <label className="form-label">Last Checked Date</label>
                <input type="date" className="form-input" value={itemForm.last_checked_date} onChange={e => setItemForm(f => ({ ...f, last_checked_date: e.target.value }))} />
              </div>

              <div className="form-group">
                <label className="form-label">Renewal (months)</label>
                <input type="number" className="form-input" min="1" max="120" value={itemForm.renewal_months} onChange={e => setItemForm(f => ({ ...f, renewal_months: e.target.value }))} placeholder="12" />
              </div>

              <div className="form-group" />

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Responsible Trustee</label>
                <select className="form-input" value={itemForm.responsible_name} onChange={e => setItemForm(f => ({ ...f, responsible_name: e.target.value }))}>
                  <option value="">— Select trustee —</option>
                  {trustees.map(t => <option key={t.full_name} value={t.full_name}>{t.full_name}</option>)}
                </select>
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Notes</label>
                <textarea className="form-input" rows={2} value={itemForm.notes} onChange={e => setItemForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes..." style={{ resize: 'vertical' }} />
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Document</label>
                {editItem?.document_name && !itemFile && (
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>
                    Current: <a href={editItem.document_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand)' }}>{editItem.document_name}</a>
                  </div>
                )}
                <input type="file" ref={itemFileRef} style={{ display: 'none' }} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={e => setItemFile(e.target.files[0] || null)} />
                <button type="button" onClick={() => itemFileRef.current?.click()}
                  style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', color: 'var(--text2)' }}>
                  {itemFile ? `📎 ${itemFile.name}` : '📎 Choose file'}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowItemModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSaveItem} className="btn-primary" disabled={itemSaving}>
                {itemSaving ? 'Saving...' : editItem ? 'Save Changes' : 'Add Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── INCIDENT MODAL ───────────────────────────────────────────────── */}
      {showIncidentModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' }}>
          <div style={{ background: 'var(--surface)', borderRadius: 14, width: '100%', maxWidth: 600, padding: 28, boxShadow: '0 8px 40px rgba(0,0,0,0.22)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, margin: 0, color: 'var(--brand)' }}>
                {editIncident ? 'Edit Incident' : 'Log Incident'}
              </h2>
              <button onClick={() => setShowIncidentModal(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text3)', lineHeight: 1 }}>✕</button>
            </div>

            {incidentError && <div style={{ background: '#faeae7', border: '1px solid #f0b8b0', borderRadius: 8, padding: '10px 14px', color: 'var(--danger)', fontSize: 13, marginBottom: 14 }}>{incidentError}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Date *</label>
                <input type="date" className="form-input" value={incidentForm.incident_date} onChange={e => setIncidentForm(f => ({ ...f, incident_date: e.target.value }))} />
              </div>

              <div className="form-group">
                <label className="form-label">Severity</label>
                <select className="form-input" value={incidentForm.severity} onChange={e => setIncidentForm(f => ({ ...f, severity: e.target.value }))}>
                  <option value="minor">Minor</option>
                  <option value="moderate">Moderate</option>
                  <option value="serious">Serious</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Title *</label>
                <input className="form-input" value={incidentForm.title} onChange={e => setIncidentForm(f => ({ ...f, title: e.target.value }))} placeholder="Brief description of the incident" />
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Description</label>
                <textarea className="form-input" rows={3} value={incidentForm.description} onChange={e => setIncidentForm(f => ({ ...f, description: e.target.value }))} placeholder="Full details of what happened..." style={{ resize: 'vertical' }} />
              </div>

              <div className="form-group">
                <label className="form-label">Location</label>
                <input className="form-input" value={incidentForm.location} onChange={e => setIncidentForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Main hall entrance" />
              </div>

              <div className="form-group">
                <label className="form-label">People Involved</label>
                <input className="form-input" value={incidentForm.people_involved} onChange={e => setIncidentForm(f => ({ ...f, people_involved: e.target.value }))} placeholder="Names of those involved" />
              </div>

              <div className="form-group">
                <label className="form-label">Responsible Trustee</label>
                <select className="form-input" value={incidentForm.responsible_name} onChange={e => setIncidentForm(f => ({ ...f, responsible_name: e.target.value }))}>
                  <option value="">— Select trustee —</option>
                  {trustees.map(t => <option key={t.full_name} value={t.full_name}>{t.full_name}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Follow-up Date</label>
                <input type="date" className="form-input" value={incidentForm.follow_up_date} onChange={e => setIncidentForm(f => ({ ...f, follow_up_date: e.target.value }))} />
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Action Taken</label>
                <textarea className="form-input" rows={2} value={incidentForm.action_taken} onChange={e => setIncidentForm(f => ({ ...f, action_taken: e.target.value }))} placeholder="Steps taken to address the incident..." style={{ resize: 'vertical' }} />
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Document</label>
                {editIncident?.document_name && !incidentFile && (
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>
                    Current: <a href={editIncident.document_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand)' }}>{editIncident.document_name}</a>
                  </div>
                )}
                <input type="file" ref={incidentFileRef} style={{ display: 'none' }} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={e => setIncidentFile(e.target.files[0] || null)} />
                <button type="button" onClick={() => incidentFileRef.current?.click()}
                  style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', color: 'var(--text2)' }}>
                  {incidentFile ? `📎 ${incidentFile.name}` : '📎 Choose file'}
                </button>
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" id="resolved-check" checked={incidentForm.resolved}
                  onChange={e => setIncidentForm(f => ({ ...f, resolved: e.target.checked }))}
                  style={{ width: 16, height: 16, cursor: 'pointer' }} />
                <label htmlFor="resolved-check" style={{ fontSize: 13, color: 'var(--text1)', cursor: 'pointer', fontWeight: 500 }}>
                  Mark as resolved
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowIncidentModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSaveIncident} className="btn-primary" disabled={incidentSaving}>
                {incidentSaving ? 'Saving...' : editIncident ? 'Save Changes' : 'Log Incident'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
