import { useState, useEffect } from 'react';
import { supabase } from './supabase';

export default function useContractors() {
  const [contractors, setContractors] = useState([]);

  useEffect(() => {
    supabase
      .from('contractors')
      .select('id, name, trade, company, phone, preferred')
      .order('name')
      .then(({ data }) => setContractors(data || []));
  }, []);

  return contractors;
}
