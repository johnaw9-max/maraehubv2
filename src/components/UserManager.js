import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const ROLE_COLORS = {
  trustee: { bg: '#e8f4ef', color: '#1a4a3a' },
  community: { bg: '#e8eef8', color: '#1a4a8a' },
};

export default function UserManager() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ full_name: '', email: '', password: '', role: 'community' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => { fetchUsers(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchUsers() {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    setUsers(data || []);
    setLoading(false);
  }

  function openAdd() {
    setForm({ full_name: '', email: '', password: '', role: 'community' });
    setEditId(null); setError(''); setSuccess(''); setShowForm(true);
  }

  function openEdit(u) {
    setForm({ full_name: u.full_name || '', email: u.email || '', password: '', role: u.role });
    setEditId(u.id); setError(''); setSuccess(''); setShowForm(true);
  }

  async function handleSave() {
    if (!form.full_name.trim()) { setError('Full name is required'); return; }
    setSaving(true); setError(''); setSuccess('');

    if (editId) {
      const { error } = await supabase.from('profiles').update({
        full_name: form.full_name.trim(),
        role: form.role,
      }).eq('id', editId);
      if (error) { setError(error.message); setSaving(false); return; }
      setSuccess('Details updated successfully.');
    } else {
      if (!form.email.trim()) { setError('Email is required'); setSaving(false); return; }
      if (!form.password || form.password.length < 6) { setError('Password must be at least 6 characters'); setSaving(false); return; }
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
      });
      if (signUpError) { setError(signUpError.message); setSaving(false); return; }
      if (signUpData?.user) {
        await supabase.from('profiles').insert({
          id: signUpData.user.id,
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          role: form.role,
        });
      }
      setSuccess(form.full_name + ' has been added. They can now log in.');
    }

    setShowForm(false); setEditId(null); setSaving(false); fetchUsers();
  }

  async function handleUpdateRole(id, newRole) {
    await supabase.from('profiles').update({ role: newRole }).eq('id', id);
    fetchUsers();
  }

  async function handleDelete(id, name) {
    if (!window.confirm('Remove ' + name + ' from MaraeHub?')) return;
    await supabase.from('profiles').delete().eq('id', id);
    fetchUsers();
  }

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function formatDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  const trustees = users.filter(u => u.role === 'trustee');
  const community = users.filter(u => u.role === 'community');

  function UserCard({ u, isTrustee }) {
    const initials = u.full_name ? u.full_name.split(' ').map(n => n[0]).join('').toUpperCase() : '?';
    const roleStyle = isTrustee ? ROLE_COLORS.trustee : ROLE_COLORS.community;
    return (
      <div className="panel" style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: isTrustee ? 'var(--brand)' : 'var(--info)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 14, color: '#fff', flexShrink: 0 }}>
          {initials}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{u.full_name || '—'}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>{u.email} · Added {formatDate(u.created_at)}</div>
        </div>
        <span style={{ fontSize: 10, borderRadius: 20, padding: '2px 10px', fontWeight: 600, background: roleStyle.bg, color: roleStyle.color }}>
          {isTrustee ? 'Trustee' : 'Community'}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => openEdit(u)} style={{ fontSize: 11, color: 'var(--brand)', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
            Edit
          </button>
          <button onClick={() => handleUpdateRole(u.id, isTrustee ? 'community' : 'trustee')} style={{ fontSize: 11, color: 'var(--text2)', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
            {isTrustee ? 'Make Community' : 'Make Trustee'}
          </button>
          <button onClick={() => handleDelete(u.id, u.full_name)} style={{ fontSize: 11, color: 'var(--danger)', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
            Remove
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 22 }}>User Management</h2>
          <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Add and manage trustees and community members</p>
        </div>
        <button className=
