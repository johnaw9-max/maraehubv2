import React from 'react';

const SECTIONS = [
  {
    heading: 'Your marae owns your data',
    body: 'Everything you enter into MaraeHub — trustee details, financial records, compliance documents, asset information — belongs to your marae. We are simply the platform that holds it securely on your behalf.',
  },
  {
    heading: 'We never sell your data',
    body: 'Your information is never sold, rented, or provided to advertisers, data brokers, or any third party for commercial gain.',
  },
  {
    heading: 'We never share your data without reason',
    body: "Your marae's information is only accessed by your authorised trustees and, where necessary, by MaraeHub support staff to maintain the platform or resolve technical issues you've raised.",
  },
  {
    heading: 'Only authorised users can view your data',
    body: "Access is restricted to the trustees you've approved through your marae's trustee permission system.",
  },
  {
    heading: 'You can request your data at any time',
    body: 'In line with the Privacy Act 2020, you have the right to access the personal information we hold and request corrections if anything is inaccurate.',
  },
  {
    heading: 'When information is entered about someone else',
    body: 'If a trustee adds details about another person — a fellow trustee, contractor, or community member — that person has the right to be told their information has been collected, in line with current NZ privacy law.',
  },
  {
    heading: 'If something ever goes wrong',
    body: 'In the unlikely event of a data breach that could cause harm, we will notify affected trustees and the Privacy Commissioner as required by law.',
  },
  {
    heading: 'Leaving MaraeHub',
    body: 'If your marae ever chooses to stop using MaraeHub, your data remains your property and can be exported or deleted on request.',
  },
];

export default function PrivacyPolicy() {
  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22 }}>Privacy &amp; Data Ownership</h2>
        <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>How MaraeHub protects your marae's information</p>
      </div>

      {/* Intro panel */}
      <div className="panel" style={{ marginBottom: 16, borderLeft: '4px solid var(--accent)', background: 'var(--surface2)' }}>
        <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, fontWeight: 700, color: 'var(--accent)', marginBottom: 10 }}>
          Your Data, Your Marae
        </div>
        <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.7 }}>
          MaraeHub exists to serve your marae — not to profit from your information. This applies from the moment you start your free trial through to becoming a paying member, with no difference in how your data is protected.
        </p>
      </div>

      {/* Section cards */}
      {SECTIONS.map((s, i) => (
        <div
          key={i}
          className="panel"
          style={{ marginBottom: 12, display: 'flex', gap: 14, alignItems: 'flex-start' }}
        >
          <div style={{
            width: 32, height: 32, borderRadius: 8, background: '#fdf0dc',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, fontSize: 15, fontWeight: 700, color: 'var(--accent)',
            fontFamily: 'Playfair Display, serif',
          }}>
            {i + 1}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent)', marginBottom: 5, fontFamily: 'Playfair Display, serif' }}>
              {s.heading}
            </div>
            <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.65 }}>
              {s.body}
            </p>
          </div>
        </div>
      ))}

      <div style={{ marginTop: 8, padding: '12px 16px', background: 'var(--cream2)', borderRadius: 10, fontSize: 12, color: 'var(--text3)', lineHeight: 1.6 }}>
        Questions about your privacy? Contact us at{' '}
        <span style={{ color: 'var(--brand-light)', fontWeight: 600 }}>support@maraehub.com</span>
      </div>
    </div>
  );
}
