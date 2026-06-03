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
