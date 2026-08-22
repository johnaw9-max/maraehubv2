import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import FormError from './FormError';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

// Fixed page order from the real official document (Waikato District
// Council / CDEM template) -- not alphabetical.
const HAZARD_ORDER = ['Landslide', 'Flood', 'Earthquake', 'Fire', 'Storm', 'Tsunami', 'Volcano', 'Pandemic', 'Man-Made Hazard', 'Water Contamination'];

const CONTACT_LISTS = [
  { key: 'marae_contact',     label: 'Marae Contacts',     hint: 'The key contacts for our marae.' },
  { key: 'emergency_contact', label: 'Emergency Contacts', hint: 'Responsible for contacting five people each -- by phone or in person -- to make sure warnings reach the whole whānau and hapū.' },
];

const SKILL_LISTS = [
  { key: 'marae_operator', label: 'Marae Operators', hint: 'People who can set up and operate the marae in an emergency.' },
  { key: 'first_aider',    label: 'First Aiders',     hint: 'People who can perform first aid.' },
];

// Pre-listed in the source document. Extensible below via "+ Add another skill".
const SPECIALISED_SKILLS_FIXED = ['Doctor', 'Nurse', 'Engineer', 'Heavy vehicle driving licence'];

const EMPTY_HAZARD_FORM = { likely_impact: '', what_to_do: '' };

// Auto-links plain https:// URLs at render time without rendering raw HTML --
// this field is editable by any trustee via a plain textarea, so switching to
// dangerouslySetInnerHTML would be a real stored-XSS risk. Restricted to
// https?:// specifically (not any scheme) so javascript: URIs can never match.
function linkify(text) {
  if (!text) return text;
  const parts = text.split(/(https?:\/\/\S+)/g);
  return parts.map((part, i) => {
    if (i % 2 === 0) return part;
    const match = part.match(/^(.*?)([.,;:)\]]*)$/);
    const url = match[1];
    const trailing = match[2];
    return (
      <React.Fragment key={i}>
        <a href={url} target="_blank" rel="noopener noreferrer">{url}</a>
        {trailing}
      </React.Fragment>
    );
  });
}
const EMPTY_PERSON_FORM = { role_category: 'marae_contact', full_name: '', phone: '', entity_id: '', skill_type: '' };

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function EmergencyPlanManager() {
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState('history');
  const [entities, setEntities] = useState([]);

  // History
  const [settingsId, setSettingsId] = useState(null);
  const [historyForm, setHistoryForm] = useState({ supported_by: '', history: '' });
  const [historySaving, setHistorySaving] = useState(false);

  // Hazards
  const [hazards, setHazards] = useState([]);
  const [showHazardModal, setShowHazardModal] = useState(false);
  const [editHazard, setEditHazard] = useState(null);
  const [hazardForm, setHazardForm] = useState(EMPTY_HAZARD_FORM);
  const [hazardSaving, setHazardSaving] = useState(false);

  // Contacts / Skilled People (both backed by emergency_plan_people)
  const [people, setPeople] = useState([]);
  const [showPersonModal, setShowPersonModal] = useState(false);
  const [editPerson, setEditPerson] = useState(null);
  const [personForm, setPersonForm] = useState(EMPTY_PERSON_FORM);
  const [skillTypeEditable, setSkillTypeEditable] = useState(true);
  const [personSaving, setPersonSaving] = useState(false);
  const [personError, setPersonError] = useState('');

  useEffect(() => { fetchAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchAll() {
    setLoading(true);
    const [settingsRes, hazardsRes, peopleRes, entRes] = await Promise.all([
      supabase.from('marae_settings').select('id, emergency_plan_history, emergency_plan_supported_by').limit(1).single(),
      supabase.from('emergency_plan_hazards').select('*'),
      supabase.from('emergency_plan_people').select('*').order('full_name'),
      supabase.from('entities').select('id, name').order('name'),
    ]);
    if (settingsRes.data) {
      setSettingsId(settingsRes.data.id);
      setHistoryForm({
        supported_by: settingsRes.data.emergency_plan_supported_by || '',
        history: settingsRes.data.emergency_plan_history || '',
      });
    }
    const sortedHazards = (hazardsRes.data || []).slice().sort(
      (a, b) => HAZARD_ORDER.indexOf(a.hazard_type) - HAZARD_ORDER.indexOf(b.hazard_type)
    );
    setHazards(sortedHazards);
    setPeople(peopleRes.data || []);
    setEntities(entRes.data || []);
    setLoading(false);
  }

  // ── HISTORY ───────────────────────────────────────────────────────────────

  async function handleSaveHistory() {
    if (!settingsId) return;
    setHistorySaving(true);
    await supabase.from('marae_settings').update({
      emergency_plan_supported_by: historyForm.supported_by.trim() || null,
      emergency_plan_history: historyForm.history.trim() || null,
    }).eq('id', settingsId);
    setHistorySaving(false);
  }

  // ── HAZARDS ───────────────────────────────────────────────────────────────

  function openEditHazard(hazard) {
    setEditHazard(hazard);
    setHazardForm({ likely_impact: hazard.likely_impact || '', what_to_do: hazard.what_to_do || '' });
    setShowHazardModal(true);
  }

  async function handleSaveHazard() {
    if (!editHazard) return;
    setHazardSaving(true);
    const payload = {
      likely_impact: hazardForm.likely_impact.trim() || null,
      what_to_do: hazardForm.what_to_do.trim() || null,
    };
    const { error } = await supabase.from('emergency_plan_hazards').update(payload).eq('id', editHazard.id);
    if (!error) {
      setHazards(prev => prev.map(h => h.id === editHazard.id ? { ...h, ...payload } : h));
      setShowHazardModal(false);
    }
    setHazardSaving(false);
  }

  // ── PEOPLE (Contacts + Skilled People) ───────────────────────────────────────

  function openAddPerson(roleCategory, lockedSkillType = null) {
    setEditPerson(null);
    setPersonForm({ ...EMPTY_PERSON_FORM, role_category: roleCategory, skill_type: lockedSkillType || '' });
    setSkillTypeEditable(lockedSkillType === null);
    setPersonError('');
    setShowPersonModal(true);
  }

  function openEditPerson(person) {
    setEditPerson(person);
    setPersonForm({
      role_category: person.role_category,
      full_name: person.full_name || '',
      phone: person.phone || '',
      entity_id: person.entity_id || '',
      skill_type: person.skill_type || '',
    });
    setSkillTypeEditable(!(person.role_category === 'specialised_skill' && SPECIALISED_SKILLS_FIXED.includes(person.skill_type)));
    setPersonError('');
    setShowPersonModal(true);
  }

  async function handleSavePerson() {
    if (!personForm.full_name.trim()) { setPersonError('Name is required.'); return; }
    setPersonSaving(true); setPersonError('');
    const payload = {
      role_category: personForm.role_category,
      full_name: personForm.full_name.trim(),
      phone: personForm.phone.trim() || null,
      entity_id: personForm.entity_id || null,
      skill_type: personForm.role_category === 'specialised_skill' ? (personForm.skill_type.trim() || null) : null,
    };
    if (editPerson) {
      const { error } = await supabase.from('emergency_plan_people').update(payload).eq('id', editPerson.id);
      if (error) { setPersonError(error.message); setPersonSaving(false); return; }
    } else {
      const { error } = await supabase.from('emergency_plan_people').insert(payload);
      if (error) { setPersonError(error.message); setPersonSaving(false); return; }
    }
    await fetchAll();
    setShowPersonModal(false);
    setPersonSaving(false);
  }

  async function deletePerson(id) {
    if (!window.confirm('Remove this contact?')) return;
    await supabase.from('emergency_plan_people').delete().eq('id', id);
    setPeople(prev => prev.filter(p => p.id !== id));
  }

  function PersonRow({ person }) {
    const entityName = person.entity_id ? entities.find(e => e.id === person.entity_id)?.name : null;
    return (
      <div className="panel" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {person.skill_type && <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--brand)', marginRight: 10 }}>{person.skill_type}:</span>}
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text1)' }}>{person.full_name}</span>
          {person.phone && <span style={{ fontSize: 14, color: 'var(--text3)', marginLeft: 10 }}>{person.phone}</span>}
          {entityName && <span style={{ fontSize: 14, color: 'var(--text3)', marginLeft: 10 }}>· {entityName}</span>}
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button onClick={() => openEditPerson(person)} style={{ fontSize: 14, color: 'var(--brand)', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontWeight: 600 }}>
            Edit
          </button>
          <button onClick={() => deletePerson(person.id)} style={{ fontSize: 12, color: 'var(--danger)', background: 'none', border: '1px solid #f0b8b0', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}>
            ✕
          </button>
        </div>
      </div>
    );
  }

  function AddSlotRow({ label, onClick }) {
    return (
      <button
        onClick={onClick}
        style={{
          width: '100%', textAlign: 'left', background: 'var(--surface2)', border: '1px dashed var(--border)',
          borderRadius: 8, padding: '10px 14px', cursor: 'pointer', fontSize: 14, color: 'var(--text3)',
          fontFamily: 'DM Sans, sans-serif',
        }}
      >
        + Add {label}
      </button>
    );
  }

  function renderPersonList(list) {
    const rows = people.filter(p => p.role_category === list.key);
    return (
      <div key={list.key}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10, gap: 12 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text1)' }}>{list.label}</div>
            <div style={{ fontSize: 14, color: 'var(--text3)' }}>{list.hint}</div>
          </div>
          <button className="btn-primary" onClick={() => openAddPerson(list.key)} style={{ fontSize: 14, flexShrink: 0 }}>
            + Add
          </button>
        </div>
        {rows.length === 0 ? (
          <div className="empty-state"><div className="emoji">📞</div><div>No {list.label.toLowerCase()} added yet</div></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {rows.map(person => <PersonRow key={person.id} person={person} />)}
          </div>
        )}
      </div>
    );
  }

  if (loading) return <div className="loading">Loading emergency plan...</div>;

  // ── RENDER ────────────────────────────────────────────────────────────────

  const specialisedSkillsPeople = people.filter(p => p.role_category === 'specialised_skill');
  const customSpecialisedSkills = specialisedSkillsPeople.filter(p => !SPECIALISED_SKILLS_FIXED.includes(p.skill_type));

  return (
    <div>

      {/* ── SECTION TOGGLE ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 16, width: 'fit-content', flexWrap: 'wrap' }}>
        {[
          { key: 'history',        label: '📜 History' },
          { key: 'hazards',        label: '⚠️ Hazards' },
          { key: 'warnings',       label: '📡 How We\'ll Be Warned' },
          { key: 'skilled_people', label: '👷 Skilled People' },
          { key: 'contacts',       label: '📞 Contacts' },
        ].map((s, i) => (
          <button
            key={s.key}
            onClick={() => setSection(s.key)}
            style={{
              padding: '9px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              background: section === s.key ? 'var(--brand)' : 'var(--surface)',
              color: section === s.key ? '#fff' : 'var(--text2)',
              border: 'none', borderRight: i < 4 ? '1px solid var(--border)' : 'none',
              fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap',
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* ── HISTORY ───────────────────────────────────────────────────────── */}
      {section === 'history' && (
        <div className="panel" style={{ padding: 20 }}>
          <div className="form-group">
            <label className="form-label">This plan will be supported by</label>
            <input
              className="form-input"
              value={historyForm.supported_by}
              onChange={e => setHistoryForm(f => ({ ...f, supported_by: e.target.value }))}
              placeholder="e.g. Waikato District Council Civil Defence Emergency Management"
            />
          </div>
          <div className="form-group">
            <label className="form-label">History of the Marae</label>
            <textarea
              className="form-input"
              rows={10}
              value={historyForm.history}
              onChange={e => setHistoryForm(f => ({ ...f, history: e.target.value }))}
              placeholder="Tell the story of the marae..."
              style={{ resize: 'vertical' }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={handleSaveHistory} className="btn-primary" disabled={historySaving}>
              {historySaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* ── HAZARDS ───────────────────────────────────────────────────────── */}
      {section === 'hazards' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {hazards.map(hazard => (
            <div key={hazard.id} className="panel" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text1)', marginBottom: 6 }}>{hazard.hazard_type}</div>
                  <div style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 3 }}>
                    <strong>Likely Impact:</strong> {hazard.likely_impact ? linkify(hazard.likely_impact) : <span style={{ color: 'var(--text3)', fontStyle: 'italic' }}>Not yet set</span>}
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--text2)' }}>
                    <strong>What to do:</strong> {hazard.what_to_do ? linkify(hazard.what_to_do) : <span style={{ color: 'var(--text3)', fontStyle: 'italic' }}>Not yet set</span>}
                  </div>
                </div>
                <button
                  onClick={() => openEditHazard(hazard)}
                  style={{ fontSize: 14, color: 'var(--brand)', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontWeight: 600, flexShrink: 0 }}
                >
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── HOW WE'LL BE WARNED (static reference, no data entry) ───────────── */}
      {section === 'warnings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px', fontSize: 14, color: 'var(--text1)' }}>
            <strong>WE WON'T get a WARNING</strong> for an earthquake or a landslide.
          </div>
          <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px', fontSize: 14, color: 'var(--text1)' }}>
            <strong>WE MIGHT get some WARNING</strong> of flooding, pandemic, forest or scrub fire, volcanic ash, or tsunami.
          </div>
          <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px', fontSize: 14, color: 'var(--text1)' }}>
            <strong>FOR A TSUNAMI</strong> generated far away from New Zealand, we could get as much as 14 hours warning.
          </div>
          <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px', fontSize: 14, color: 'var(--text1)' }}>
            We will get a <strong>FLOOD WARNING</strong> from either Civil Defence, the Emergency Response Team, or a member of the community.
          </div>
          <div style={{ background: '#fce8e8', border: '1px solid #f5b8b8', borderLeft: '4px solid #8b0000', borderRadius: 8, padding: '14px 16px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#8b0000', marginBottom: 4 }}>WE WILL GET WARNINGS FROM A NUMBER OF SOURCES</div>
            <div style={{ fontSize: 14, color: '#a63020' }}>These will come from the radio, tv, sirens, text messages, email, social media, or a phone call.</div>
          </div>
        </div>
      )}

      {/* ── SKILLED PEOPLE ────────────────────────────────────────────────── */}
      {section === 'skilled_people' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {SKILL_LISTS.map(renderPersonList)}

          <div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text1)' }}>Specialised Skills</div>
              <div style={{ fontSize: 14, color: 'var(--text3)' }}>People with specialised skills -- doctor, nurse, engineer, heavy vehicle licence, and any others.</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {SPECIALISED_SKILLS_FIXED.map(skillType => {
                const person = specialisedSkillsPeople.find(p => p.skill_type === skillType);
                return person
                  ? <PersonRow key={skillType} person={person} />
                  : <AddSlotRow key={skillType} label={skillType} onClick={() => openAddPerson('specialised_skill', skillType)} />;
              })}
              {customSpecialisedSkills.map(person => <PersonRow key={person.id} person={person} />)}
            </div>
            <button
              onClick={() => openAddPerson('specialised_skill')}
              className="btn-secondary"
              style={{ fontSize: 14, marginTop: 10 }}
            >
              + Add another skill
            </button>
          </div>
        </div>
      )}

      {/* ── CONTACTS ──────────────────────────────────────────────────────── */}
      {section === 'contacts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {CONTACT_LISTS.map(renderPersonList)}
        </div>
      )}

      {/* ── HAZARD MODAL ──────────────────────────────────────────────────── */}
      {showHazardModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' }}>
          <div style={{ background: 'var(--surface)', borderRadius: 14, width: '100%', maxWidth: 520, padding: 28, boxShadow: '0 8px 40px rgba(0,0,0,0.22)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, margin: 0, color: 'var(--brand)' }}>
                {editHazard?.hazard_type}
              </h2>
              <button onClick={() => setShowHazardModal(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text3)', lineHeight: 1 }}>✕</button>
            </div>

            <div className="form-group">
              <label className="form-label">Likely Impact</label>
              <textarea className="form-input" rows={3} value={hazardForm.likely_impact} onChange={e => setHazardForm(f => ({ ...f, likely_impact: e.target.value }))} style={{ resize: 'vertical' }} />
            </div>
            <div className="form-group">
              <label className="form-label">What to do</label>
              <textarea className="form-input" rows={3} value={hazardForm.what_to_do} onChange={e => setHazardForm(f => ({ ...f, what_to_do: e.target.value }))} style={{ resize: 'vertical' }} />
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowHazardModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSaveHazard} className="btn-primary" disabled={hazardSaving}>
                {hazardSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PERSON MODAL ──────────────────────────────────────────────────── */}
      {showPersonModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' }}>
          <div style={{ background: 'var(--surface)', borderRadius: 14, width: '100%', maxWidth: 480, padding: 28, boxShadow: '0 8px 40px rgba(0,0,0,0.22)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, margin: 0, color: 'var(--brand)' }}>
                {editPerson ? 'Edit Contact' : 'Add Contact'}
              </h2>
              <button onClick={() => setShowPersonModal(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text3)', lineHeight: 1 }}>✕</button>
            </div>

            <FormError message={personError} />

            {personForm.role_category === 'specialised_skill' && (
              <div className="form-group">
                <label className="form-label">Skill</label>
                <input
                  className="form-input"
                  value={personForm.skill_type}
                  disabled={!skillTypeEditable}
                  onChange={e => setPersonForm(f => ({ ...f, skill_type: e.target.value }))}
                  placeholder="e.g. Welder, Chainsaw operator"
                  style={!skillTypeEditable ? { background: 'var(--surface2)', color: 'var(--text3)' } : undefined}
                />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input className="form-input" value={personForm.full_name} onChange={e => setPersonForm(f => ({ ...f, full_name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="form-input" value={personForm.phone} onChange={e => setPersonForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            {entities.length > 0 && (
              <div className="form-group">
                <label className="form-label">Entity</label>
                <select className="form-input" value={personForm.entity_id} onChange={e => setPersonForm(f => ({ ...f, entity_id: e.target.value }))}>
                  <option value="">— Shared (all entities) —</option>
                  {entities.map(ent => <option key={ent.id} value={ent.id}>{ent.name}</option>)}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowPersonModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSavePerson} className="btn-primary" disabled={personSaving}>
                {personSaving ? 'Saving...' : editPerson ? 'Save Changes' : 'Add Contact'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
