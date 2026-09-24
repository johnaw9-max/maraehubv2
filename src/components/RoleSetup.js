import React, { useState } from 'react';
import { startWorkflow } from '../lib/workflowEngine';

// Settings > Trustee Permissions > "Role Setup" (2026-09-24). Real,
// working flow for Secretary only -- Chairperson and Treasurer show the
// same generic duty list for preview, but their "Coming Soon" state is
// genuine: no workflow_templates row exists for either yet, so nothing
// is created in the database when viewing them. See
// ROLE_SETUP_CONFIG in src/lib/taskSync.js, which only Secretary is
// registered in.

const ROLES = [
  {
    key: 'secretary',
    label: 'Secretary',
    icon: '📝',
    templateName: 'Secretary Role Setup',
    duties: [
      'Take and distribute minutes after every hui',
      'Keep meeting records and resolutions on file',
      'Maintain the trustee/contact list',
      'Handle official correspondence',
    ],
    active: true,
  },
  {
    key: 'chairperson',
    label: 'Chairperson',
    icon: '🏛️',
    duties: [
      'Chair meetings and ensure the agenda is followed',
      'Cast the deciding vote in a tie',
      'Represent the marae at official functions',
      'Review governance performance annually',
    ],
    active: false,
  },
  {
    key: 'treasurer',
    label: 'Treasurer',
    icon: '💰',
    duties: [
      'Manage day-to-day banking and reconcile accounts',
      'Present a financial report at each meeting',
      'Prepare the annual financial report for the AGM',
      'Oversee budget and expenditure approval',
    ],
    active: false,
  },
];

const MEETING_FREQUENCIES = [
  { value: 'monthly',   label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'biannual',  label: 'Every 6 months' },
  { value: 'annual',    label: 'Annually' },
];

export default function RoleSetupModal({ trustee, templates, onClose, onStarted }) {
  const [selectedRole, setSelectedRole] = useState(null);
  const [name, setName] = useState(trustee.full_name || '');
  const [meetingFrequency, setMeetingFrequency] = useState('monthly');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  async function handleStart() {
    const template = (templates || []).find(t => t.name === selectedRole.templateName);
    if (!template) {
      setError('Secretary Role Setup template not found — nothing was started.');
      return;
    }
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    setStarting(true);
    setError('');
    try {
      await startWorkflow(template.id, {
        name: `${selectedRole.label} Role Setup — ${name.trim()}`,
        entity_name: name.trim(),
        entity_type: 'profile',
        entity_id: trustee.id,
        trigger_type: 'role_setup',
        context_data: { meeting_frequency: meetingFrequency },
      });
      setStarting(false);
      onStarted?.();
      onClose();
    } catch (err) {
      setStarting(false);
      setError(err.message || 'Could not start Role Setup.');
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1001, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' }}>
      <div style={{ background: 'var(--surface)', borderRadius: 14, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', padding: 28, boxShadow: '0 8px 40px rgba(0,0,0,0.22)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, margin: 0, color: 'var(--brand)' }}>
            {selectedRole ? `${selectedRole.label} Role Setup` : `Role Setup — ${trustee.full_name || trustee.email}`}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text3)', lineHeight: 1 }}>✕</button>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

        {!selectedRole && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 13, color: 'var(--text3)', margin: 0 }}>
              Pick a role to see its standard duties and set up its recurring reminders.
            </p>
            {ROLES.map(role => (
              <div key={role.key} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 18 }}>{role.icon}</span>
                  <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text1)' }}>{role.label}</span>
                  {!role.active && (
                    <span style={{ fontSize: 11, color: 'var(--text3)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '2px 8px', marginLeft: 'auto' }}>
                      Coming Soon
                    </span>
                  )}
                </div>
                <ul style={{ margin: '0 0 12px', paddingLeft: 20, fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
                  {role.duties.map(d => <li key={d}>{d}</li>)}
                </ul>
                <button
                  disabled={!role.active}
                  onClick={() => role.active && setSelectedRole(role)}
                  style={{
                    fontSize: 13, padding: '7px 14px', borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: role.active ? 'var(--brand)' : 'var(--surface)',
                    color: role.active ? '#fff' : 'var(--text3)',
                    fontWeight: 600,
                    cursor: role.active ? 'pointer' : 'default',
                  }}
                >
                  {role.active ? 'Set Up This Role →' : 'Coming Soon'}
                </button>
              </div>
            ))}
          </div>
        )}

        {selectedRole && (
          <div>
            <button onClick={() => { setSelectedRole(null); setError(''); }} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 16 }}>
              ← Back to roles
            </button>

            <div className="form-group">
              <label className="form-label">Your name</label>
              <input className="form-input" value={name} onChange={e => setName(e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label">How often does your marae meet?</label>
              <select className="form-input" value={meetingFrequency} onChange={e => setMeetingFrequency(e.target.value)}>
                {MEETING_FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                Sets how often the "Take Hui Minutes" reminder repeats.
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn-secondary" onClick={onClose} disabled={starting}>Cancel</button>
              <button className="btn-primary" onClick={handleStart} disabled={starting}>
                {starting ? 'Starting…' : 'Start Role Setup'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
