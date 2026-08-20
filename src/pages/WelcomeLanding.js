import React from 'react';

const AREAS = [
  { icon: '📋', label: 'Compliance' },
  { icon: '🚨', label: 'Emergency Readiness' },
  { icon: '🔧', label: 'Assets & Maintenance' },
  { icon: '✅', label: 'Tasks' },
  { icon: '🏛️', label: 'Governance' },
  { icon: '📄', label: 'Documents' },
  { icon: '📅', label: 'Bookings' },
  { icon: '📁', label: 'Projects' },
];

const PROBLEMS = [
  'Compliance renewal gets missed',
  'Fire extinguisher service becomes overdue',
  'Grant deadline is missed',
  'Important document cannot be found',
  'Nobody knows who is responsible for an action',
];

const FOUNDING_EMAIL = 'mailto:maraehub@gmail.com?subject=Founding%20Marae%20Enquiry';
const DEMO_EMAIL = 'mailto:maraehub@gmail.com?subject=Demo%20Request';

export default function WelcomeLanding() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--brand)' }}>
      <div style={{ padding: '60px 20px 80px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, background: '#fff', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Playfair Display, serif', fontWeight: 700, fontSize: 26, color: 'var(--brand)', marginBottom: 28 }}>M</div>

        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 34, fontWeight: 700, color: '#fff', maxWidth: 680, lineHeight: 1.3, margin: 0 }}>
          MaraeHub — Helping marae trustees stay organised, prepared and on top of compliance.
        </h1>

        <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.85)', maxWidth: 560, marginTop: 20, lineHeight: 1.6 }}>
          MaraeHub brings the important parts of running a marae into one place — so nothing depends on one person remembering everything.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, maxWidth: 640, width: '100%', marginTop: 40 }}>
          {AREAS.map(a => (
            <div key={a.label} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, padding: '16px 10px', color: '#fff' }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>{a.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{a.label}</div>
            </div>
          ))}
        </div>

        <a href="#more" style={{ marginTop: 44, background: '#c8902a', color: '#fff', border: 'none', borderRadius: 8, padding: '14px 32px', fontSize: 15, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', fontFamily: 'DM Sans, sans-serif', letterSpacing: '0.02em' }}>
          SEE MARAEHUB IN ACTION
        </a>
      </div>

      <div id="more" style={{ background: 'var(--surface)', padding: '70px 20px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 26, fontWeight: 700, color: 'var(--text1)', margin: 0, lineHeight: 1.3 }}>
            What happens when the person who remembers everything isn't available?
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 36, textAlign: 'left' }}>
            {PROBLEMS.map(p => (
              <div key={p} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 16 }}>⚠️</span>
                <span style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.4 }}>{p}</span>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 16, color: 'var(--text2)', marginTop: 36, lineHeight: 1.6 }}>
            MaraeHub is a shared system — so your marae's compliance, maintenance and governance don't depend on one person remembering everything.
          </p>
        </div>
      </div>

      <div style={{ background: 'var(--brand)', padding: '70px 20px' }}>
        <div style={{ maxWidth: 480, margin: '0 auto', background: '#fff', borderRadius: 16, padding: '40px 32px', textAlign: 'center', border: '2px solid #c8902a', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#c8902a', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>
            Founding Marae Offer
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 18, color: 'var(--text3)', textDecoration: 'line-through' }}>$99/month</span>
            <span style={{ fontFamily: 'Playfair Display, serif', fontSize: 40, fontWeight: 700, color: 'var(--brand)' }}>
              $49.50<span style={{ fontSize: 16, fontWeight: 600 }}>/month</span>
            </span>
          </div>

          <div style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 20 }}>
            50% off for your first 12 months
          </div>

          <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.6, marginBottom: 20 }}>
            After your first 12 months, standard pricing of $99/month applies. This is not a permanent discount.
          </div>

          <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 14, fontWeight: 600, color: 'var(--text1)', marginBottom: 24 }}>
            Limited to the first 10 marae
          </div>

          <a href={FOUNDING_EMAIL} style={{ display: 'inline-block', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 8, padding: '14px 32px', fontSize: 15, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', fontFamily: 'DM Sans, sans-serif', letterSpacing: '0.02em' }}>
            BECOME A FOUNDING MARAE
          </a>
        </div>
      </div>

      <div style={{ background: 'var(--surface)', padding: '60px 20px', textAlign: 'center' }}>
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, fontWeight: 700, color: 'var(--text1)', margin: 0 }}>
            Not sure if MaraeHub is right for your marae?
          </h2>
          <p style={{ fontSize: 15, color: 'var(--text2)', marginTop: 14, lineHeight: 1.6 }}>
            Book a 20-minute kōrero and demonstration. No pressure. No commitment. We'll show you how it works and answer your questions.
          </p>
          <a href={DEMO_EMAIL} style={{ display: 'inline-block', marginTop: 24, background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 8, padding: '14px 32px', fontSize: 15, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', fontFamily: 'DM Sans, sans-serif', letterSpacing: '0.02em' }}>
            BOOK A DEMO
          </a>
        </div>
      </div>

      <div style={{ background: 'var(--surface2)', padding: '50px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 15, color: 'var(--text3)', maxWidth: 480, margin: '0 auto' }}>
          More coming soon — we're building this page section by section.
        </div>
      </div>
    </div>
  );
}
