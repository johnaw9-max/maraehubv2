import { useState, useEffect } from 'react';
import { supabase } from './supabase';

export default function useEntities() {
  const [entities, setEntities] = useState([]);

  useEffect(() => {
    supabase.from('entities').select('id, name').order('name').then(({ data }) => {
      setEntities(data || []);
    });
  }, []);

  return entities;
}
