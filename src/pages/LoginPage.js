import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSent, setResetSent] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  }

  async function handleReset(e) {
    e.preventDefault();
    if (!resetEmail.trim()) { setResetError('Please enter your email address.'); return; }
    setResetLoading(true);
    setResetError('');
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim());
    if (error) { setResetError(error.message); setResetLoading(false); return; }
    setResetSent(true);
    setResetLoading(false);
  }

  function openReset() {
    setShowReset(true);
    setResetEmail('');
    setResetError('');
    setResetSent(false);
  }

  function closeReset() {
    setShowReset(false);
    setResetEmail('');
    setResetError('');
    setResetSent(false);
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--brand)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, position: 'relative', overflow: 'hidden'
    }}>
      {/* Background pattern */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 40px, rgba(255,255,255,0.02) 40px, rgba(255,255,255,0.02) 80px)',
        pointerEvents: 'none'
      }} />

      <div style={{
        background: 'var(--surface)', borderRadius: 20,
        padding: '40px 36px', width: '100%', maxWidth: 420,
        position: 'relative', zIndex: 1,
        boxShadow: '0 24px 64px rgba(0,0,0,0.3)'
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, background: 'var(--brand)',
            borderRadius: 12, display: 'flex', alignItems: 'center',
            justifyContent: 'center', margin: '0 auto 14px',
          }}>
            <span style={{ fontFamily: 'serif', fontWeight: 700, fontSize: 26, color: 'var(--accent)' }}>M</span>
          </div>
          <h1 style={{ fontSize: 28, color: 'var(--text1)', marginBottom: 4 }}>MaraeHub</h1>
          <p style={{ fontSize: 13, color: 'var(--text3)' }}>Te Marae o Tainui · Manurewa</p>
        </div>

        {/* ── SIGN IN FORM ─────────────────────────────────────────────── */}
        {!showReset && (
          <>
            {error && <div className="alert alert-error">{error}</div>}

            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="you@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn-primary"
                disabled={loading}
                style={{ width: '100%', padding: '13px', fontSize: 15, marginTop: 8 }}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button
                type="button"
                onClick={openReset}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--brand-light)', textDecoration: 'underline', fontFamily: 'DM Sans, sans-serif' }}
              >
                Forgot password?
              </button>
            </div>
          </>
        )}

        {/* ── FORGOT PASSWORD FORM ─────────────────────────────────────── */}
        {showReset && (
          <>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, fontWeight: 600, marginBottom: 8, color: 'var(--text1)' }}>
              Reset Password
            </div>
            <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20, lineHeight: 1.6 }}>
              Enter your email address and we'll send you a link to reset your password.
            </p>

            {resetError && <div className="alert alert-error">{resetError}</div>}

            {resetSent ? (
              <>
                <div className="alert alert-success">
                  Check your email for a reset link.
                </div>
                <button
                  type="button"
                  onClick={closeReset}
                  className="btn-secondary"
                  style={{ width: '100%', marginTop: 8 }}
                >
                  Back to Sign In
                </button>
              </>
            ) : (
              <form onSubmit={handleReset}>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="you@email.com"
                    value={resetEmail}
                    onChange={e => setResetEmail(e.target.value)}
                    autoFocus
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={resetLoading}
                  style={{ width: '100%', padding: '13px', fontSize: 15, marginTop: 8 }}
                >
                  {resetLoading ? 'Sending...' : 'Send Reset Link'}
                </button>
                <button
                  type="button"
                  onClick={closeReset}
                  className="btn-secondary"
                  style={{ width: '100%', marginTop: 10 }}
                >
                  Back to Sign In
                </button>
              </form>
            )}
          </>
        )}

        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 11, color: 'var(--text3)' }}>
          MaraeHub NZ Ltd · maraehub.com
        </div>
      </div>
    </div>
  );
}
