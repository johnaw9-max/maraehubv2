import { useState, useEffect } from 'react';
import { supabase } from './supabase';

export default function useProfiles() {
  const [profiles, setProfiles] = useState([]);

  useEffect(() => {
    Promise.all([
      supabase.from('profiles').select('full_name, role').order('full_name'),
      supabase.from('contacts').select('full_name, role').order('full_name'),
    ]).then(([pRes, cRes]) => {
      const merged = [...(pRes.data || []), ...(cRes.data || [])];
      merged.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
      setProfiles([
        ...merged.filter(p => p.role === 'trustee'),
        ...merged.filter(p => p.role !== 'trustee'),
      ]);
    });
  }, []);

  return profiles;
}
