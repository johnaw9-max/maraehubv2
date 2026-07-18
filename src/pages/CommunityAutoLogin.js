import React, { useEffect, useRef, useState } from 'react';
import { supabase, supabaseAnonKey } from '../lib/supabase';

export default function CommunityAutoLogin() {
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Starting…');
  const ranRef = useRef(false);

  useEffect(() => {
    // React 18 StrictMode double-invokes effects in development — without this
    // guard, the whole signOut → generate → verify chain runs twice, and the
    // two runs can race (a second signOut() clobbering the first run's
    // freshly-established session, or a second generateLink invalidating the
    // first run's still-unverified token).
    if (ranRef.current) return;
    ranRef.current = true;

    (async () => {
      try {
        setStatus('Clearing any existing session…');
        console.log('[CommunityAutoLogin] signing out any existing session');
        await supabase.auth.signOut();

        const params = new URLSearchParams(window.location.search);
        const token = params.get('k');
        console.log('[CommunityAutoLogin] token param present:', !!token);

        if (!token) {
          setError('Missing access token.');
          return;
        }

        setStatus('Requesting sign-in link…');
        const { data, error: fnError } = await supabase.functions.invoke('community-auto-login', {
          body: { token },
          headers: { Authorization: `Bearer ${supabaseAnonKey}` },
        });
        console.log('[CommunityAutoLogin] edge function response:', { data, fnError });

        if (fnError || !data?.token_hash) {
          setError(fnError?.message || data?.error || 'Could not sign in.');
          return;
        }

        setStatus('Verifying…');
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: data.token_hash,
          type: 'magiclink',
        });
        console.log('[CommunityAutoLogin] verifyOtp result:', { verifyError });

        if (verifyError) {
          setError(verifyError.message);
          return;
        }

        setStatus('Signed in — redirecting…');
        window.history.replaceState({}, '', '/');
      } catch (err) {
        console.error('[CommunityAutoLogin] unexpected error:', err);
        setError(err.message || 'Unexpected error during sign-in.');
      }
    })();
  }, []);

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16 }}>
        <div style={{ color: 'var(--danger)', fontSize: 14, fontWeight: 600 }}>Sign-in failed</div>
        <div style={{ color: 'var(--text3)', fontSize: 13 }}>{error}</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 12 }}>
      <div className="loading">{status}</div>
    </div>
  );
}
