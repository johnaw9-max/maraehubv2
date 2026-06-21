import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const TRADES = [
  'Plumber', 'Electrician', 'Builder', 'Roofer', 'Painter',
  'Landscaper', 'Cleaning', 'IT', 'Legal', 'Accounting', 'Other',
];

const TRADE_STYLE = {
  Plumber:     { bg: '#e8eef8', color: '#1a4a8a' },
  Electrician: { bg: '#fdf8dc', color: '#7a5a00' },
  Builder:     { bg: '#f0e8dc', color: '#6a3a10' },
  Roofer:      { bg: '#eaeaea', color: '#444444' },
  Painter:     { bg: '#f0ecf8', color: '#6b42a8' },
  Landscaper:  { bg: '#e8f4ef', color: '#1a4a3a' },
  Cleaning:    { bg: '#e0f4f4', color: '#0a5a5a' },
  IT:          { bg: '#e8eef8', color: '#1a3a8a' },
  Legal:       { bg: '#fdecea', color: '#7a1a1a' },
  Accounting:  { bg: '#e8f4ef', color: '#2d6e57' },
  Other:       { bg: '#f5f0e8', color: '#7a7268' },
};

const EMPTY_USER_FORM       = { full_name: '', email: '', password: '', phone: '', role: 'community', notes: '' };
const EMPTY_CONTRACTOR_FORM = { name: '', trade: 'Plumber', company: '', phone: '', email: '', address: '', notes: '', preferred: false };

function fmt(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── FILTER PILL ──────────────────────────────────────────────────────────────

function Pill({ label, count, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
        cursor: 'pointer', border: active ? 'none' : '1px solid var(--border)',
        background: active ? 'var(--brand)' : 'var(--surface2)',
        color: active ? '#fff' : 'var(--text2)',
      }}
    >
      {label} ({count})
    </button>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function ContactsManager() {
  const [users, setUsers]             = useState([]);
  const [contractors, setContractors] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [filter, setFilter]           = useState('all');

  // User form
  const [showUserForm, setShowUserForm]     = useState(false);
  const [editUserId, setEditUserId]         = useState(null);
  const [editUserSource, setEditUserSource] = useState('profiles');
  const [userForm, setUserForm]             = useState(EMPTY_USER_FORM);

  // Contractor form
  const [showContractorForm, setShowContractorForm] = useState(false);
  const [editContractorId, setEditContractorId]     = useState(null);
  const [contractorForm, setContractorForm]         = useState(EMPTY_CONTRACTOR_FORM);

  // Shared
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null); // { id, type, name }

  useEffect(() => { fetchAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchAll() {
    setLoading(true);
    const [uRes, cRes, ctRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('contractors').select('*').order('name'),
      supabase.from('contacts').select('*').order('created_at', { ascending: false }),
    ]);
    const profileUsers  = (uRes.data  || []).map(u => ({ ...u, _source: 'profiles' }));
    const contactsUsers = (ctRes.data || []).map(u => ({ ...u, _source: 'contacts' }));
    setUsers([...profileUsers, ...contactsUsers]);
    setContractors(cRes.data || []);
    setLoading(false);
  }

  function tableFor(id) {
    return users.find(u => u.id === id)?._source === 'contacts' ? 'contacts' : 'profiles';
  }

  // ─── KPIs ──────────────────────────────────────────────────────────────────

  const kpis = useMemo(() => ({
    total:       users.length + contractors.length,
    trustees:    users.filter(u => u.role === 'trustee').length,
    community:   users.filter(u => u.role === 'community').length,
    contractors: contractors.length,
    preferred:   contractors.filter(c => c.preferred).length,
  }), [users, contractors]);

  // ─── FILTERED LISTS ────────────────────────────────────────────────────────

  const q = search.toLowerCase().trim();

  const filteredUsers = useMemo(() => {
    if (filter === 'contractors') return [];
    return users.filter(u => {
      if (filter === 'trustees'  && u.role !== 'trustee')   return false;
      if (filter === 'community' && u.role !== 'community') return false;
      if (!q) return true;
      return u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
    });
  }, [users, filter, q]);

  const filteredContractors = useMemo(() => {
    if (filter === 'trustees' || filter === 'community') return [];
    return contractors.filter(c => {
      if (!q) return true;
      return c.name?.toLowerCase().includes(q) || c.trade?.toLowerCase().includes(q) || c.company?.toLowerCase().includes(q);
    });
  }, [contractors, filter, q]);

  // ─── USER HANDLERS ─────────────────────────────────────────────────────────

  function openAddUser() {
    setUserForm(EMPTY_USER_FORM);
    setEditUserId(null);
    setError(''); setSuccess('');
    setShowUserForm(true);
    setShowContractorForm(false);
  }

  function openEditUser(u) {
    setUserForm({ full_name: u.full_name || '', email: u.email || '', password: '', phone: u.phone || '', role: u.role, notes: u.notes || '' });
    setEditUserId(u.id);
    setEditUserSource(u._source || 'profiles');
    setError(''); setSuccess('');
    setShowUserForm(true);
    setShowContractorForm(false);
  }

  async function handleSaveUser() {
    if (!userForm.full_name.trim()) { setError('Full name is required'); return; }
    if (userForm.role === 'trustee' && !userForm.email.trim()) { setError('Trustees must have an email address to log in and receive permissions'); return; }
    setSaving(true); setError(''); setSuccess('');
    if (editUserId) {
      const updates = {
        full_name: userForm.full_name.trim(),
        role:      userForm.role,
        email:     userForm.email.trim()  || null,
        phone:     userForm.phone.trim()  || null,
        notes:     userForm.notes.trim()  || null,
      };
      const { error: err } = await supabase.from(editUserSource).update(updates).eq('id', editUserId);
      if (err) { setError(err.message); setSaving(false); return; }
      setSuccess('Details updated.');
    } else {
      if (userForm.email.trim()) {
        if (!userForm.password || userForm.password.length < 6) { setError('Password min 6 chars'); setSaving(false); return; }
        const { data: sd, error: se } = await supabase.auth.signUp({ email: userForm.email.trim(), password: userForm.password });
        if (se) { setError(se.message); setSaving(false); return; }
        if (sd?.user) {
          await supabase.from('profiles').insert({ id: sd.user.id, full_name: userForm.full_name.trim(), email: userForm.email.trim(), role: userForm.role, phone: userForm.phone.trim() || null, notes: userForm.notes.trim() || null });
        }
      } else {
        const { error: err } = await supabase.from('contacts').insert({ full_name: userForm.full_name.trim(), role: userForm.role, phone: userForm.phone.trim() || null, notes: userForm.notes.trim() || null });
        if (err) { setError(err.message); setSaving(false); return; }
      }
      setSuccess(userForm.full_name + ' added.');
    }
    setShowUserForm(false); setEditUserId(null); setSaving(false);
    fetchAll();
  }

  async function handleUpdateRole(id, role) {
    await supabase.from(tableFor(id)).update({ role }).eq('id', id);
    fetchAll();
  }

  // ─── CONTRACTOR HANDLERS ───────────────────────────────────────────────────

  function openAddContractor() {
    setContractorForm(EMPTY_CONTRACTOR_FORM);
    setEditContractorId(null);
    setError(''); setSuccess('');
    setShowContractorForm(true);
    setShowUserForm(false);
  }

  function openEditContractor(c) {
    setContractorForm({ name: c.name || '', trade: c.trade || 'Plumber', company: c.company || '', phone: c.phone || '', email: c.email || '', address: c.address || '', notes: c.notes || '', preferred: c.preferred || false });
    setEditContractorId(c.id);
    setError(''); setSuccess('');
    setShowContractorForm(true);
    setShowUserForm(false);
  }

  async function handleSaveContractor() {
    if (!contractorForm.name.trim()) { setError('Name is required.'); return; }
    setSaving(true); setError('');
    const payload = {
      name:      contractorForm.name.trim(),
      trade:     contractorForm.trade,
      company:   contractorForm.company.trim()  || null,
      phone:     contractorForm.phone.trim()    || null,
      email:     contractorForm.email.trim()    || null,
      address:   contractorForm.address.trim()  || null,
      notes:     contractorForm.notes.trim()    || null,
      preferred: contractorForm.preferred,
    };
    const { error: err } = editContractorId
      ? await supabase.from('contractors').update(payload).eq('id', editContractorId)
      : await supabase.from('contractors').insert(payload);
    if (err) { setError(err.message); setSaving(false); return; }
    setShowContractorForm(false); setEditContractorId(null); setSaving(false);
    fetchAll();
  }

  async function togglePreferred(c) {
    await supabase.from('contractors').update({ preferred: !c.preferred }).eq('id', c.id);
    fetchAll();
  }

  // ─── DELETE ────────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!confirmDelete) return;
    if (confirmDelete.type === 'user') {
      await supabase.from(tableFor(confirmDelete.id)).delete().eq('id', confirmDelete.id);
    } else {
      await supabase.from('contractors').delete().eq('id', confirmDelete.id);
    }
    setConfirmDelete(null);
    fetchAll();
  }

  // ─── KPI TILES ─────────────────────────────────────────────────────────────

  const KPI_TILES = [
    { label: 'Total Contacts', value: kpis.total,       icon: '👥', bg: '#e8eef8', valueColor: 'var(--text1)' },
    { label: 'Trustees',       value: kpis.trustees,    icon: '🏛️', bg: '#e8f4ef', valueColor: 'var(--brand)' },
    { label: 'Community',      value: kpis.community,   icon: '🌿', bg: '#f0ecf8', valueColor: '#6b42a8' },
    { label: 'Contractors',    value: kpis.contractors, icon: '🔨', bg: '#fdf0dc', valueColor: kpis.contractors > 0 ? 'var(--warning)' : 'var(--text3)' },
  ];

  const totalFiltered = filteredUsers.length + filteredContractors.length;

  return (
    <div>
      {/* ── KPI TILES ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {KPI_TILES.map((t, i) => (
          <div key={i} className="panel" style={{ textAlign: 'center', padding: '14px 10px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, margin: '0 auto 8px' }}>
              {t.icon}
            </div>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, fontWeight: 600, color: t.valueColor, marginBottom: 4 }}>
              {t.value}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500 }}>{t.label}</div>
          </div>
        ))}
      </div>

      {/* ── TOOLBAR ────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 14, pointerEvents: 'none' }}>🔍</span>
          <input
            type="text"
            className="form-input"
            placeholder="Search all contacts..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 32, width: 260 }}
          />
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {(filter === 'all' || filter === 'trustees' || filter === 'community') && (
            <button className="btn-primary" onClick={openAddUser} style={{ fontSize: 13 }}>+ Add User</button>
          )}
          {(filter === 'all' || filter === 'contractors') && (
            <button
              onClick={openAddContractor}
              style={{ background: 'var(--accent)', color: 'var(--brand)', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              + Add Contractor
            </button>
          )}
        </div>
      </div>

      {/* ── FILTER PILLS ───────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <Pill label="All"         count={users.length + contractors.length} active={filter === 'all'}         onClick={() => setFilter('all')} />
        <Pill label="Trustees"    count={kpis.trustees}                     active={filter === 'trustees'}    onClick={() => setFilter('trustees')} />
        <Pill label="Community"   count={kpis.community}                    active={filter === 'community'}   onClick={() => setFilter('community')} />
        <Pill label="Contractors" count={kpis.contractors}                  active={filter === 'contractors'} onClick={() => setFilter('contractors')} />
      </div>

      {/* ── ALERTS ─────────────────────────────────────────────────────────── */}
      {error   && <div className="alert alert-error"   style={{ marginBottom: 12 }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: 12 }}>{success}</div>}

      {/* ── ADD / EDIT USER FORM ───────────────────────────────────────────── */}
      {showUserForm && (
        <div className="panel" style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
            {editUserId ? 'Edit User' : 'Add New User'}
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input className="form-input" value={userForm.full_name} onChange={e => setUserForm(f => ({ ...f, full_name: e.target.value }))} placeholder="e.g. Hemi Walker" autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">Role</label>
              <select className="form-input" value={userForm.role} onChange={e => setUserForm(f => ({ ...f, role: e.target.value }))}>
                <option value="community">Community Member</option>
                <option value="trustee">Trustee</option>
              </select>
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">
                Email
                {userForm.role === 'trustee'
                  ? <span style={{ color: 'var(--danger, #c0392b)' }}> *</span>
                  : !editUserId && <span style={{ fontWeight: 400, color: 'var(--text3)' }}> (optional)</span>}
              </label>
              <input type="email" className="form-input" value={userForm.email} onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))} placeholder="e.g. hemi@email.com" />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input type="tel" className="form-input" value={userForm.phone} onChange={e => setUserForm(f => ({ ...f, phone: e.target.value }))} placeholder="e.g. 021 123 4567" />
            </div>
          </div>
          {!editUserId && userForm.email.trim() && (
            <div className="form-group">
              <label className="form-label">Temporary Password *</label>
              <input type="password" className="form-input" value={userForm.password} onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))} placeholder="Min 6 characters" />
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Share this with the user</div>
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-input" value={userForm.notes} onChange={e => setUserForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any additional notes..." rows={2} style={{ resize: 'vertical' }} />
          </div>
          <div className="modal-actions">
            <button className="btn-secondary" onClick={() => { setShowUserForm(false); setEditUserId(null); }}>Cancel</button>
            <button className="btn-primary" onClick={handleSaveUser} disabled={saving}>
              {saving ? 'Saving...' : editUserId ? 'Save Changes' : 'Add User'}
            </button>
          </div>
        </div>
      )}

      {/* ── ADD / EDIT CONTRACTOR FORM ─────────────────────────────────────── */}
      {showContractorForm && (
        <div className="panel" style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
            {editContractorId ? 'Edit Contractor' : 'Add Contractor'}
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input className="form-input" value={contractorForm.name} onChange={e => setContractorForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">Trade *</label>
              <select className="form-input" value={contractorForm.trade} onChange={e => setContractorForm(f => ({ ...f, trade: e.target.value }))}>
                {TRADES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Company</label>
            <input className="form-input" value={contractorForm.company} onChange={e => setContractorForm(f => ({ ...f, company: e.target.value }))} placeholder="Business name (optional)" />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="form-input" value={contractorForm.phone} onChange={e => setContractorForm(f => ({ ...f, phone: e.target.value }))} placeholder="e.g. 021 123 4567" />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input type="email" className="form-input" value={contractorForm.email} onChange={e => setContractorForm(f => ({ ...f, email: e.target.value }))} placeholder="email@example.com" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Address</label>
            <input className="form-input" value={contractorForm.address} onChange={e => setContractorForm(f => ({ ...f, address: e.target.value }))} placeholder="Street address or suburb" />
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-input" rows={2} value={contractorForm.notes} onChange={e => setContractorForm(f => ({ ...f, notes: e.target.value }))} placeholder="Rates, availability, past work notes..." style={{ resize: 'vertical' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, padding: '10px 14px', background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)' }}>
            <span style={{ fontSize: 18 }}>⭐</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Preferred Contractor</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>Mark as the go-to for this trade</div>
            </div>
            <button
              type="button"
              onClick={() => setContractorForm(f => ({ ...f, preferred: !f.preferred }))}
              style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', background: contractorForm.preferred ? 'var(--brand)' : '#ccc', position: 'relative', flexShrink: 0 }}
            >
              <span style={{ position: 'absolute', top: 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', left: contractorForm.preferred ? 23 : 3, transition: 'left 0.15s' }} />
            </button>
          </div>
          <div className="modal-actions">
            <button className="btn-secondary" onClick={() => { setShowContractorForm(false); setEditContractorId(null); }}>Cancel</button>
            <button className="btn-primary" onClick={handleSaveContractor} disabled={saving}>
              {saving ? 'Saving...' : editContractorId ? 'Save Changes' : 'Add Contractor'}
            </button>
          </div>
        </div>
      )}

      {/* ── CONTENT ────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="loading">Loading contacts...</div>
      ) : totalFiltered === 0 ? (
        <div className="empty-state">
          <div className="emoji">👥</div>
          <div>{search ? 'No contacts match your search.' : 'No contacts yet.'}</div>
        </div>
      ) : (
        <>
          {/* ── USERS SECTION ──────────────────────────────────────────────── */}
          {filteredUsers.length > 0 && (
            <div style={{ marginBottom: filteredContractors.length > 0 ? 28 : 0 }}>
              {filter === 'all' && (
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 20, height: 2, background: 'var(--brand)', display: 'inline-block', borderRadius: 1 }} />
                  Members ({filteredUsers.length})
                </div>
              )}
              {filteredUsers.map(u => {
                const isTrustee = u.role === 'trustee';
                const ini = u.full_name ? u.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?';
                return (
                  <div key={u.id} className="panel" style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10, padding: '14px 16px' }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: isTrustee ? 'var(--brand)' : 'var(--info)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 14, color: '#fff', flexShrink: 0 }}>
                      {ini}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{u.full_name || '—'}</div>
                      <div style={{ fontSize: 12, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.email}{u.created_at ? ` · Added ${fmt(u.created_at)}` : ''}
                      </div>
                    </div>
                    <span style={{ fontSize: 10, borderRadius: 20, padding: '2px 10px', fontWeight: 600, background: isTrustee ? '#e8f4ef' : '#e8eef8', color: isTrustee ? '#1a4a3a' : '#1a4a8a', flexShrink: 0 }}>
                      {isTrustee ? 'Trustee' : 'Community'}
                    </span>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => openEditUser(u)} style={{ fontSize: 11, color: 'var(--brand)', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}>Edit</button>
                      <button onClick={() => handleUpdateRole(u.id, isTrustee ? 'community' : 'trustee')} style={{ fontSize: 11, color: 'var(--text2)', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}>
                        {isTrustee ? 'Make Community' : 'Make Trustee'}
                      </button>
                      <button onClick={() => setConfirmDelete({ id: u.id, type: 'user', name: u.full_name })} style={{ fontSize: 11, color: 'var(--danger)', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}>Remove</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── CONTRACTORS SECTION ────────────────────────────────────────── */}
          {filteredContractors.length > 0 && (
            <div>
              {filter === 'all' && (
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 20, height: 2, background: 'var(--accent)', display: 'inline-block', borderRadius: 1 }} />
                  Contractors ({filteredContractors.length})
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                {filteredContractors.map(c => {
                  const ts = TRADE_STYLE[c.trade] || TRADE_STYLE.Other;
                  return (
                    <div key={c.id} className="panel" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                      <div style={{ background: ts.bg, padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                        <div>
                          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{c.name}</div>
                          <span style={{ fontSize: 11, background: ts.color + '20', color: ts.color, border: `1px solid ${ts.color}40`, borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>{c.trade}</span>
                        </div>
                        <button onClick={() => togglePreferred(c)} title={c.preferred ? 'Remove preferred' : 'Mark preferred'} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 17, padding: 0, flexShrink: 0 }}>
                          {c.preferred ? '⭐' : '☆'}
                        </button>
                      </div>
                      <div style={{ padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {c.preferred && <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fdf8dc', color: '#7a5a00', border: '1px solid #e8d880', borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 600, alignSelf: 'flex-start', marginBottom: 2 }}>⭐ Preferred</div>}
                        {c.company && <div style={{ fontSize: 12, color: 'var(--text2)', display: 'flex', gap: 5 }}><span>🏢</span>{c.company}</div>}
                        {c.phone   && <div style={{ fontSize: 12, color: 'var(--text2)', display: 'flex', gap: 5 }}><span>📞</span><a href={`tel:${c.phone}`} style={{ color: 'var(--brand-light)', textDecoration: 'none' }}>{c.phone}</a></div>}
                        {c.email   && <div style={{ fontSize: 12, color: 'var(--text2)', display: 'flex', gap: 5, overflow: 'hidden' }}><span style={{ flexShrink: 0 }}>✉️</span><a href={`mailto:${c.email}`} style={{ color: 'var(--brand-light)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email}</a></div>}
                        {c.notes   && <div style={{ fontSize: 11, color: 'var(--text3)', fontStyle: 'italic', lineHeight: 1.4 }}>{c.notes.length > 80 ? c.notes.slice(0, 80) + '…' : c.notes}</div>}
                      </div>
                      <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
                        <button onClick={() => openEditContractor(c)} style={{ flex: 1, background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 0', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Edit</button>
                        <button onClick={() => setConfirmDelete({ id: c.id, type: 'contractor', name: c.name })} style={{ flex: 1, background: '#faeae7', color: 'var(--danger)', border: '1px solid #f0b8b0', borderRadius: 6, padding: '5px 0', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── DELETE CONFIRM MODAL ───────────────────────────────────────────── */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setConfirmDelete(null); }}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-title" style={{ fontSize: 18 }}>
              {confirmDelete.type === 'user' ? 'Remove User?' : 'Delete Contractor?'}
            </div>
            <p style={{ color: 'var(--text2)', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
              <strong>{confirmDelete.name}</strong> will be permanently removed. This cannot be undone.
            </p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn-danger" onClick={handleDelete}>
                {confirmDelete.type === 'user' ? 'Remove' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
