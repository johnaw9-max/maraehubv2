import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
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

        <div style={{
          marginTop: 28, padding: '16px', background: 'var(--surface2)',
          borderRadius: 10, border: '1px solid var(--border)'
        }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, fontWeight: 600 }}>
            Test Accounts
          </div>
          <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.8 }}>
            <strong>Trustee:</strong> trustee@maraehub.com / Trustee123!<br />
            <strong>Community:</strong> community@maraehub.com / Community123!
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 11, color: 'var(--text3)' }}>
          MaraeHub NZ Ltd · maraehub.com
        </div>
      </div>
    </div>
  );
}
