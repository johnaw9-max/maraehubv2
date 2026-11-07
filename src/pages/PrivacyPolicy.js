import React from 'react';

const BRAND = { green: '#1a4a3a', gold: '#c8902a', bg: '#f7f5f2', card: '#fff', border: '#e0dbd4', text: '#2a2520', muted: '#7a7268' };

export default function PrivacyPolicy() {
  return (
    <div style={{ minHeight: '100vh', background: BRAND.bg, fontFamily: "'Inter', 'Segoe UI', sans-serif", color: BRAND.text }}>

      {/* Header */}
      <div style={{ background: BRAND.green, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 40, height: 40, background: BRAND.gold, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'serif', fontWeight: 700, fontSize: 20, color: BRAND.green, flexShrink: 0 }}>
          M
        </div>
        <div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>MaraeHub</div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>Privacy Policy</div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 24px 80px' }}>

        <h1 style={{ fontSize: 28, fontWeight: 800, color: BRAND.green, marginBottom: 6 }}>Privacy Policy</h1>
        <p style={{ color: BRAND.muted, fontSize: 14, marginBottom: 32 }}>
          MaraeHub NZ Ltd &nbsp;·&nbsp; Last updated: 6 November 2026
        </p>

        {/* Māori data sovereignty statement */}
        <div style={{ background: '#e8f4ef', border: `1px solid ${BRAND.green}30`, borderLeft: `4px solid ${BRAND.green}`, borderRadius: 8, padding: '18px 20px', marginBottom: 36 }}>
          <div style={{ fontWeight: 700, color: BRAND.green, marginBottom: 6, fontSize: 15 }}>He kōrero mō ngā raraunga Māori — Māori Data Sovereignty</div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: BRAND.text }}>
            MaraeHub recognises that marae data belongs to the marae and the hapū it serves. We are kaitiaki (guardians) of that data, not owners. Your marae's information will never be sold, shared with third parties for commercial purposes, or used to train artificial intelligence models without your explicit consent. You have the right to request the export or deletion of your marae's data at any time.
          </p>
        </div>

        <Section title="1. Who we are">
          <p>MaraeHub NZ Ltd is a New Zealand-registered company (NZBN: registered) providing governance and compliance software to New Zealand marae. Our contact email is <a href="mailto:johnaw9@gmail.com" style={{ color: BRAND.green }}>johnaw9@gmail.com</a>.</p>
        </Section>

        <Section title="2. What data we collect">
          <p>We collect only what is needed to provide the platform:</p>
          <ul>
            <li><strong>Trustee accounts:</strong> full name, email address, phone number, role within the marae.</li>
            <li><strong>Marae governance records:</strong> meeting minutes, resolutions, action items, compliance documents, incident reports, financial income and expense records, booking information, and goal tracking data entered by trustees.</li>
            <li><strong>Files and documents:</strong> PDFs, images, and other files you upload (compliance certificates, finance receipts, emergency response evidence, general documents).</li>
            <li><strong>Usage data:</strong> an audit log of who accessed or changed sensitive records within the platform (used to protect your marae, never shared externally).</li>
            <li><strong>Authentication data:</strong> managed by Supabase Auth — we store email addresses and hashed passwords only.</li>
          </ul>
          <p>We do not collect payment card details. Subscription payments are processed by Stripe, who have their own privacy policy.</p>
        </Section>

        <Section title="3. Where your data is stored">
          <DataStorageTable />
          <p style={{ marginTop: 12 }}>All data is stored in Australia or South Korea — no data is stored offshore outside these regions. No data is stored in Singapore. Supabase uses AWS infrastructure.</p>
        </Section>

        <Section title="4. Who can access your data">
          <p>Access is controlled by our Row Level Security system. Only:</p>
          <ul>
            <li>Trustees of your marae (authenticated users you have added to your account) can view your marae's data.</li>
            <li>MaraeHub's founder (Waj Williams) can access anonymised aggregate statistics for product improvement — never individual marae records.</li>
            <li>Supabase (our infrastructure provider) has access to encrypted database infrastructure only, under their own privacy and security obligations.</li>
          </ul>
          <p>We will never sell, rent, or share your data with any third party for commercial purposes. We will disclose data only if required by New Zealand law.</p>
        </Section>

        <Section title="5. AI features">
          <p>MaraeHub includes optional AI-assisted drafting features (such as draft meeting agendas and resolution summaries). These features are <strong>opt-in only</strong> — they are not enabled by default.</p>
          <p>If your marae administrator enables AI drafting, relevant information may be sent to Anthropic's API (which may process it outside New Zealand) to generate a draft: rough notes you type, grant details, or a summary of your records, including names of people responsible and, for administrators, finance figures. A clear warning and consent prompt will appear before any data is sent. You may disable AI features at any time in your Marae Settings.</p>
          <p>MaraeHub does not use your governance data to train AI models. MaraeHub reaches Anthropic through its business API, where Anthropic's published terms say customer content is not used to train its models. Anthropic may keep content for a limited period, and longer if it is flagged for misuse or the law requires it. Because AI is switched off until your administrator turns it on, nothing is sent unless your marae chooses it.</p>
        </Section>

        <Section title="6. Data retention">
          <p>Your data is retained for as long as your marae holds an active subscription. If you cancel your subscription:</p>
          <ul>
            <li>Your data is retained for 90 days to allow for reactivation or export.</li>
            <li>After 90 days, all data associated with your marae account is permanently deleted.</li>
            <li>You may request immediate deletion at any time by emailing us.</li>
          </ul>
        </Section>

        <Section title="7. Your rights">
          <p>Under the New Zealand Privacy Act 2020, you have the right to:</p>
          <ul>
            <li>Request access to the personal information we hold about you.</li>
            <li>Request correction of inaccurate personal information.</li>
            <li>Request deletion of your personal information.</li>
            <li>Export a copy of your marae's data at any time.</li>
          </ul>
          <p>To exercise any of these rights, email <a href="mailto:johnaw9@gmail.com" style={{ color: BRAND.green }}>johnaw9@gmail.com</a> with the subject line "Privacy Request".</p>
        </Section>

        <Section title="8. Cookies and tracking">
          <p>MaraeHub uses browser local storage to remember your login session. We do not use advertising trackers, third-party analytics, or cookies beyond what is necessary to keep you logged in.</p>
        </Section>

        <Section title="9. Changes to this policy">
          <p>We may update this policy from time to time. We will notify active subscribers by email before any material change takes effect. The current version is always available at <strong>maraehub.co.nz/privacy</strong>.</p>
        </Section>

        <Section title="10. Contact">
          <p>Questions about this policy? Contact Waj Williams, MaraeHub NZ Ltd:<br />
          Email: <a href="mailto:johnaw9@gmail.com" style={{ color: BRAND.green }}>johnaw9@gmail.com</a>
          </p>
        </Section>

        <div style={{ marginTop: 48, paddingTop: 24, borderTop: `1px solid ${BRAND.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <span style={{ color: BRAND.muted, fontSize: 13 }}>© 2026 MaraeHub NZ Ltd. All rights reserved.</span>
          <button
            onClick={() => window.history.back()}
            style={{ background: BRAND.green, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, cursor: 'pointer', fontWeight: 600 }}
          >
            ← Back
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 17, fontWeight: 700, color: BRAND.green, marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${BRAND.border}` }}>{title}</h2>
      <div style={{ fontSize: 14, lineHeight: 1.75, color: BRAND.text }}>
        {children}
      </div>
    </div>
  );
}

function DataStorageTable() {
  const rows = [
    { marae: 'Ōpeke Marae', region: 'Seoul, South Korea (AWS ap-northeast-2)' },
    { marae: 'Terere Marae', region: 'Sydney, Australia (AWS ap-southeast-2)' },
    { marae: 'Test / sandbox', region: 'Sydney, Australia (AWS ap-southeast-2)' },
    { marae: 'Iwi Hub data', region: 'Sydney, Australia (AWS ap-southeast-2)' },
  ];
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 10 }}>
      <thead>
        <tr style={{ background: '#e8f4ef' }}>
          <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: `1px solid ${BRAND.border}`, color: BRAND.green, fontWeight: 700 }}>Marae / Project</th>
          <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: `1px solid ${BRAND.border}`, color: BRAND.green, fontWeight: 700 }}>Data region</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : BRAND.bg }}>
            <td style={{ padding: '8px 12px', borderBottom: `1px solid ${BRAND.border}` }}>{r.marae}</td>
            <td style={{ padding: '8px 12px', borderBottom: `1px solid ${BRAND.border}` }}>{r.region}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
