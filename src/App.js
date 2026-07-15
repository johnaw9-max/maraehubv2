import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import LoginPage from './pages/LoginPage';
import TrusteeDashboard from './pages/TrusteeDashboard';
import CommunityPortal from './pages/CommunityPortal';
import FounderDashboard from './components/FounderDashboard';
import PublicBookingRequest from './pages/PublicBookingRequest';

const FOUNDER_EMAILS = ['johnaw9@gmail.com', 'waj@maraehub.co.nz'];

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState(null);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    // onAuthStateChange fires INITIAL_SESSION synchronously on mount in Supabase v2.5+,
    // so getSession() is redundant and causes a dual-fetch race condition — use this alone.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSession(session);
        setRecovering(true);
        setLoading(false);
        return;
      }
      setRecovering(false);
      setSession(session);
      if (session) {
        fetchProfile(session.user.id, session.user.email);
      } else {
        setProfile(null);
        setProfileError(null);
        setLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchProfile(userId, authEmail) {
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
      setProfile({ ...data, email: authEmail });
      console.log('[App] fetchProfile data:', data);
      console.log('[App] fetchProfile data.role:', data?.role, '| typeof:', typeof data?.role);
    }
    setLoading(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  if (window.location.pathname === '/request-booking') {
    return <PublicBookingRequest />;
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16 }}>
        <div style={{ width: 48, height: 48, background: '#1a4a3a', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'serif', fontWeight: 700, fontSize: 22, color: '#c8902a' }}>M</div>
        <div style={{ color: '#7a7268', fontSize: 14 }}>Loading MaraeHub...</div>
      </div>
    );
  }

  if (recovering) return <SetNewPasswordForm onDone={() => {
    if (session) fetchProfile(session.user.id);
    setRecovering(false);
  }} />;

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

  if (FOUNDER_EMAILS.includes(profile?.email) && window.location.pathname === '/founder') {
    return <FounderDashboard profile={profile} />;
  }

  if (profile?.role === 'trustee') {
    return <TrusteeDashboard profile={profile} onLogout={handleLogout} />;
  }

  return <CommunityPortal profile={profile} onLogout={handleLogout} />;
}

function SetNewPasswordForm({ onDone }) {
  const [pw, setPw]           = useState('');
  const [pw2, setPw2]         = useState('');
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (pw.length < 6)    { setError('Password must be at least 6 characters.'); return; }
    if (pw !== pw2)        { setError('Passwords do not match.'); return; }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setSaving(false);
    if (error) { setError(error.message); return; }
    setSuccess(true);
    setTimeout(onDone, 2000);
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg, #f5f0e8)' }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: '40px 36px', width: '100%', maxWidth: 380, boxShadow: '0 4px 24px rgba(0,0,0,0.10)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
          <div style={{ width: 44, height: 44, background: '#1a4a3a', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'serif', fontWeight: 700, fontSize: 20, color: '#c8902a', marginBottom: 14 }}>M</div>
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, fontWeight: 700, color: '#1a4a3a' }}>Set New Password</div>
          <div style={{ fontSize: 13, color: '#7a7268', marginTop: 6, textAlign: 'center' }}>Choose a new password for your MaraeHub account.</div>
        </div>
        {success ? (
          <div style={{ background: '#e8f4ef', border: '1px solid #a8d8c0', borderRadius: 8, padding: '14px 16px', fontSize: 14, color: '#1a4a3a', textAlign: 'center' }}>
            ✓ Password updated! Redirecting you now...
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {error && <div style={{ background: '#faeae7', border: '1px solid #f0b8b0', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#c0392b' }}>{error}</div>}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#3a3530', display: 'block', marginBottom: 5 }}>New Password</label>
              <input
                type="password"
                value={pw}
                onChange={e => setPw(e.target.value)}
                placeholder="At least 6 characters"
                required
                style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e0dbd4', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#3a3530', display: 'block', marginBottom: 5 }}>Confirm New Password</label>
              <input
                type="password"
                value={pw2}
                onChange={e => setPw2(e.target.value)}
                placeholder="Repeat your new password"
                required
                style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e0dbd4', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              style={{ marginTop: 4, padding: '11px', background: '#1a4a3a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Saving...' : 'Set Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
