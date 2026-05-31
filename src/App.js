import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import LoginPage from './pages/LoginPage';
import TrusteeDashboard from './pages/TrusteeDashboard';
import CommunityPortal from './pages/CommunityPortal';

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else { setProfile(null); setLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId) {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (!error) setProfile(data);
    setLoading(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16 }}>
        <div style={{ width: 48, height: 48, background: '#1a4a3a', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'serif', fontWeight: 700, fontSize: 22, color: '#c8902a' }}>M</div>
        <div style={{ color: '#7a7268', fontSize: 14 }}>Loading MaraeHub...</div>
      </div>
    );
  }

  if (!session) return <LoginPage />;

  if (profile?.role === 'trustee') {
    return <TrusteeDashboard profile={profile} onLogout={handleLogout} />;
  }

  return <CommunityPortal profile={profile} onLogout={handleLogout} />;
}
