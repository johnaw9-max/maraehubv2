import { createClient } from '@supabase/supabase-js';

export const supabaseTerere = createClient(
  process.env.REACT_APP_SUPABASE_URL || 'https://cbeenkpjpnhmtqtnjiyd.supabase.co',
  process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNiZWVua3BqcG5obXRxdG5qaXlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxNDc1ODMsImV4cCI6MjA5NTcyMzU4M30.-D80hZlHwzUAa3eBfh29EPtVsXXo4A9YNVHDFlLFIkM'
);

export const supabaseTineka = createClient(
  'https://zfefukxaliuximizjkwa.supabase.co',
  process.env.REACT_APP_TINEKA_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmZWZ1a3hhbGl1eGltaXpqa3dhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxNTc4OTgsImV4cCI6MjA5NTczMzg5OH0.HMwi6ARjVM270WdXUYvgIiD2M1SwZ7Dfa7pfCcoEDt0'
);

export const supabaseWaioweka = process.env.REACT_APP_WAIOWEKA_ANON_KEY
  ? createClient('https://kifqftelvliywqkizsho.supabase.co', process.env.REACT_APP_WAIOWEKA_ANON_KEY)
  : null;
