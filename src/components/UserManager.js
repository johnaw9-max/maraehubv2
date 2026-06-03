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
        }
