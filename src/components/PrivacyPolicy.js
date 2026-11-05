import React from 'react';

// Phase 1, item 8 (P1-08). Wording approved for correction by John Williams,
// 5 Nov 2026; draft in the Phase 1 report. Recommend a lawyer reviews it.
// When P1-02 Release 2 is tested and live, replace FILE_ACCESS_TODAY with
// FILE_ACCESS_AFTER_P1_02. When the storage region is verified (P1-04),
// name it in the providers section.
const FILE_ACCESS_TODAY =
  "Files you upload (documents, compliance evidence, receipts) are stored separately. Only signed-in trustees can upload, replace or delete them, but at present anyone who has the direct link to a specific file can open it, like a shared Google Drive link. Please don't share file links outside your trustees. We are changing this so files can only be opened by signed-in trustees of your marae.";
// eslint-disable-next-line no-unused-vars
const FILE_ACCESS_AFTER_P1_02 =
  'Files you upload are protected so they can only be opened by signed-in trustees of your marae, through links that expire after a short time.';

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
    heading: 'Who processes your information for us',
    body: "MaraeHub uses a small number of service providers to run the platform. They process your marae's information on MaraeHub's instructions and only to provide your service, not for their own purposes. They are: Supabase (database, sign-in and file storage), Vercel (delivers the website), Resend (sends reminder and booking emails), Sentry (error reports, so we can fix problems) and, only when a trustee chooses to use an AI feature, Anthropic (see \"AI features\" below). Connections your marae switches on, such as Xero or Google Calendar, send information to those services at your direction. Some of these providers store or process information outside New Zealand.",
  },
  {
    heading: 'AI features',
    body: "Some features can prepare a draft for you using AI, such as turning rough hui notes into draft minutes. When a trustee chooses to use one, the text they supply and basic details about your marae are sent to Anthropic's Claude AI service, which may process them outside New Zealand. MaraeHub asks for confirmation before notes are sent, and your marae's admin can switch AI drafting off. Please don't include sensitive personal, whānau, tangi or dispute details in notes sent to AI. AI output is only a draft: nothing is saved to your records until a trustee reviews and saves it.",
  },
  {
    heading: 'Who can see your data',
    body: "Your marae's records are accessed by the trustees you approve and, where needed to keep the platform running or to resolve an issue you've raised, by MaraeHub's founder. Access to records is restricted through your marae's trustee permission system and enforced by the database. " + FILE_ACCESS_TODAY,
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
    body: 'If your marae ever chooses to stop using MaraeHub, your data remains your property. You can ask us to export or delete it, and we handle those requests directly with you.',
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
        <span style={{ color: 'var(--brand-light)', fontWeight: 600 }}>johnaw9@gmail.com</span>
      </div>
    </div>
  );
}
