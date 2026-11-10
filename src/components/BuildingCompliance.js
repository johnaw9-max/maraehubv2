import React, { useState } from 'react';

// "What must a marae have?" Plain-language guide shown next to the Building Plan.
// General information only, not legal advice. Every legal statement below comes from
// a published NZ source listed in SOURCES. Where the law depends on the building or
// how it is used, the item says "check your building" rather than guessing.

export const BASIS = {
  law:   { label: 'Law, if it applies to you', bg: '#FAEAE7', color: '#A32D2D' },
  check: { label: 'Check your building',       bg: '#FDF3E3', color: '#8a5a10' },
  good:  { label: 'Good practice',             bg: '#E8F4EF', color: '#1a6a3a' },
};

export const LEGAL_NOTES = [
  {
    title: 'There is no one rule for all marae',
    text: 'What a marae needs depends on the size of its buildings, whether people sleep in them, and when they were built (reported by RNZ). Fire and Emergency NZ (FENZ) urges every marae to think about fire safety, especially sleeping areas.',
  },
  {
    title: 'Fire evacuation scheme',
    text: 'Some buildings must have a FENZ-approved evacuation scheme, for example those that sleep people, hold over 100 members of the public, employ 10 or more people, or hold certain hazardous substances. If a building owner does not provide or maintain a required scheme, they can be prosecuted (Fire and Emergency NZ Act 2017, sections 76 and 79). Several buildings on one site can share one scheme application.',
  },
  {
    title: 'First aid',
    text: 'If your marae is a workplace under the Health and Safety at Work Act 2015 (for example it has workers, or volunteers for an organisation that falls under the Act), it must provide adequate first aid equipment, make sure people can reach it, and have enough trained first aiders (Regulations 2016, regulation 13). WorkSafe says only certain volunteer organisations fall under the Act.',
  },
  {
    title: 'Emergency plan',
    text: 'Organisations covered by the Health and Safety at Work Act must also prepare, maintain and implement an emergency plan (Regulations 2016, regulation 14). That is what the rest of this Emergency Plan section helps you build.',
  },
];

// Per pin type: basis and the one-line reason shown in the checklist.
export const PIN_COMPLIANCE = {
  first_aid:         { basis: 'law',   why: 'Adequate first aid equipment is required at a workplace. Keep it easy to reach and stocked.' },
  assembly_point:    { basis: 'law',   why: 'Part of your evacuation procedure. An approved evacuation scheme is required for some buildings.' },
  exit:              { basis: 'check', why: 'Safe exits need to be clear and known. Your evacuation procedure or scheme should show them.' },
  fire_alarm:        { basis: 'check', why: 'Whether you need one depends on how the building is used and when it was built. Sleeping areas matter most.' },
  fire_extinguisher: { basis: 'check', why: 'Whether you must have them depends on your building. FENZ can advise your marae.' },
  defibrillator:     { basis: 'good',  why: 'I did not find a general legal requirement. Recommended where people gather.' },
  power_shutoff:     { basis: 'good',  why: 'So anyone can switch off power quickly in an emergency.' },
  water_shutoff:     { basis: 'good',  why: 'So anyone can stop a burst pipe or flood quickly.' },
  gas_shutoff:       { basis: 'good',  why: 'So anyone can isolate gas quickly, if you have it.' },
  torch_radio:       { basis: 'good',  why: 'Useful when the power and phones are out.' },
};

export const SOURCES = [
  { label: 'FENZ: fire safety regulatory framework', url: 'https://fireandemergency.nz/business-and-landlords/fire-safety-regulatory-framework' },
  { label: 'FENZ: evacuation scheme application guide', url: 'https://www.fireandemergency.nz/assets/Documents/EvacuationSchemes/Evacuation-scheme-application-reference-guide.pdf' },
  { label: 'FENZ: evacuation procedures and schemes info sheet', url: 'https://fireandemergency.nz/assets/Documents/Business-and-Landlords/Fire-Safety-Evacuation-Procedures-and-Evacuation-Schemes-Info-Sheet.pdf' },
  { label: 'WorkSafe: first aid', url: 'https://www.worksafe.govt.nz/managing-health-and-safety/businesses/general-requirements-for-workplaces/first-aid' },
  { label: 'WorkSafe: volunteers, key things to know', url: 'https://registers.worksafe.govt.nz/managing-health-and-safety/getting-started/understanding-the-law/volunteers/volunteers-key-things-to-know' },
  { label: 'RNZ: no one fire rule for all marae', url: 'https://www.rnz.co.nz/news/te-manu-korihi/391828/tapu-te-ranga-blaze-sheds-spotlight-on-lack-of-fire-safety-across-all-marae' },
];

export const DISCLAIMER = 'General guide only, not legal advice. Your own buildings and how you use them decide what applies. FENZ gives marae fire safety advice, and your local council can confirm building requirements.';

// pins: every pin saved for this marae. pinTypes: [{value,label,icon}].
export default function BuildingCompliancePanel({ pins, pinTypes }) {
  const [open, setOpen] = useState(false);
  const rows = pinTypes.filter(t => PIN_COMPLIANCE[t.value]).map(t => ({
    ...t, ...PIN_COMPLIANCE[t.value], count: pins.filter(p => p.pin_type === t.value).length,
  }));
  const order = { law: 0, check: 1, good: 2 };
  rows.sort((a, b) => order[a.basis] - order[b.basis]);
  const missingLaw = rows.filter(r => r.basis === 'law' && r.count === 0).length;

  return (
    <div className="panel" style={{ padding: '14px 16px', marginTop: 24 }}>
      <button onClick={() => setOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left', padding: 0, fontFamily: 'inherit' }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--brand)' }}>📋 What must a marae have? {open ? '▲' : '▼'}</span>
        <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>
          {missingLaw > 0
            ? `${missingLaw} item${missingLaw > 1 ? 's' : ''} the law may require ${missingLaw > 1 ? 'are' : 'is'} not on your plan yet.`
            : 'The items the law may require are all on your plan.'}
        </div>
      </button>

      {open && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Your checklist</div>
          {rows.map(r => (
            <div key={r.value} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)', alignItems: 'flex-start' }}>
              <div style={{ width: 22, fontSize: 16, color: r.count ? '#1a6a3a' : '#A32D2D', fontWeight: 700 }}>{r.count ? '✓' : '○'}</div>
              <div style={{ flex: 1, fontSize: 14 }}>
                <div>
                  {r.icon} <strong>{r.label}</strong>{' '}
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: BASIS[r.basis].bg, color: BASIS[r.basis].color, whiteSpace: 'nowrap' }}>{BASIS[r.basis].label}</span>
                  <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 8 }}>{r.count ? `${r.count} on plan` : 'not on plan yet'}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>{r.why}</div>
              </div>
            </div>
          ))}

          <div style={{ fontSize: 14, fontWeight: 700, margin: '18px 0 6px' }}>What the law says</div>
          {LEGAL_NOTES.map(n => (
            <div key={n.title} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{n.title}</div>
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>{n.text}</div>
            </div>
          ))}
          <div style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic', margin: '12px 0' }}>{DISCLAIMER}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            Sources:{' '}
            {SOURCES.map((s, i) => (
              <span key={s.url}>
                <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand)' }}>{s.label}</a>{i < SOURCES.length - 1 ? ' · ' : ''}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
