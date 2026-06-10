import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import LoginPage from './pages/LoginPage';
import TrusteeDashboard from './pages/TrusteeDashboard';
import CommunityPortal from './pages/CommunityPortal';

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState(null);

  useEffect(() => {
    // onAuthStateChange fires INITIAL_SESSION synchronously on mount in Supabase v2.5+,
    // so getSession() is redundant and causes a dual-fetch race condition — use this alone.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setProfileError(null);
        setLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchProfile(userId) {
    setLoading(true);
    setProfileError(null);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) {
      console.error('[App] fetchProfile failed:', error.message);
      setProfileError(error.message);
    } else {
      setProfile(data);
    }
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

  if (profileError) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16 }}>
        <div style={{ width: 48, height: 48, background: '#1a4a3a', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'serif', fontWeight: 700, fontSize: 22, color: '#c8902a' }}>M</div>
        <div style={{ color: '#7a7268', fontSize: 14, textAlign: 'center', maxWidth: 320 }}>
          Could not load your profile. Please refresh the page or sign out and back in.
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => fetchProfile(session.user.id)} style={{ padding: '8px 20px', background: '#1a4a3a', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>
            Retry
          </button>
          <button onClick={handleLogout} style={{ padding: '8px 20px', background: 'none', color: '#7a7268', border: '1px solid #e0dbd4', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  if (profile?.role === 'trustee') {
    return <TrusteeDashboard profile={profile} onLogout={handleLogout} />;
  }

  return <CommunityPortal profile={profile} onLogout={handleLogout} />;
}
