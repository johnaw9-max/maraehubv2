import { useState, useEffect } from 'react';
import { supabase } from './supabase';

export default function useProfiles() {
  const [profiles, setProfiles] = useState([]);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('full_name, role')
      .order('full_name')
      .then(({ data }) => {
        if (!data) return;
        setProfiles([
          ...data.filter(p => p.role === 'trustee'),
          ...data.filter(p => p.role !== 'trustee'),
        ]);
      });
  }, []);

  return profiles;
}
