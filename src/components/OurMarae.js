// OurMarae.js — "Our Marae" trustee reference page
// Shows: team, tools, upcoming meetings, past minutes, documents, processes & passwords pointer
// Tested on Terere first — designed to work for every marae instance.

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import OrgChart from './OrgChart';

const TEAL = 'var(--brand)';

const SECTION = ({ icon, title, children }) => (
  <div style={{ marginBottom: 28 }}>
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      borderBottom: `2px solid ${TEAL}`, paddingBottom: 8, marginBottom: 16,
    }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: TEAL }}>{title}</h2>
    </div>
    {children}
  </div>
);

const CARD = ({ children, style }) => (
  <div style={{
    background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
    padding: '14px 18px', marginBottom: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    ...style,
  }}>
    {children}
  </div>
);

const PILL = ({ label, color, bg }) => (
  <span style={{
    fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 20,
    background: bg || '#e8f4ef', color: color || '#1a4a3a', whiteSpace: 'nowrap',
  }}>{label}</span>
);

const ALL_TOOLS = {
  maraehub:    { emoji: '✅', name: 'MaraeHub',       job: 'Compliance & Governance',   who: 'Secretary',              notFor: 'Bookings',              textColor: '#1a4a3a' },
  marae_online:{ emoji: '📅', name: 'Marae Online',   job: 'Bookings & Hire',            who: 'Bookings Coordinator',   notFor: 'Compliance, minutes',   textColor: '#1a4a8a' },
  board_pro:   { emoji: '📋', name: 'Board Pro',       job: 'Meeting Minutes & Reports',  who: 'Secretary',              notFor: 'Compliance, bookings',  textColor: '#6b42a8' },
  teams:       { emoji: '💬', name: 'Microsoft Teams', job: 'Day-to-Day Communication',   who: 'All Trustees',           notFor: 'Official records',      textColor: '#7a4f00' },
  sharepoint:  { emoji: '📁', name: 'SharePoint',      job: 'Document Storage',           who: 'Secretary',              notFor: 'Chat, compliance',      textColor: '#a63020' },
  xero:        { emoji: '💰', name: 'Xero',            job: 'Accounting & Invoicing',     who: 'Treasurer',              notFor: 'Compliance, bookings',  textColor: '#1a6a4a' },
  outlook:     { emoji: '📧', name: 'Outlook',         job: 'Shared Email',               who: 'Secretary',              notFor: 'Task tracking',         textColor: '#1a4a8a' },
};

const ENTITY_TYPE_LABELS = {
  incorporated_society: 'Incorporated Society',
  charitable_trust: 'Charitable Trust',
  land_trust: 'Land Trust',
  trading_trust: 'Trading Trust',
  other: 'Entity',
};

const ROLE_COLORS = {
  'admin':     { label: 'Admin',     bg: '#e8f4ef', color: '#1a4a3a' },
  'trustee':   { label: 'Trustee',   bg: '#e8eef8', color: '#1a4a8a' },
  'community': { label: 'Community', bg: '#f0ecf8', color: '#6b42a8' },
};

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
}

function isUpcoming(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr) >= new Date(new Date().toDateString());
}

export default function OurMarae({ isAdmin }) {
  const [profiles, setProfiles] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedMeeting, setExpandedMeeting] = useState(null);
  const [maraeName, setMaraeName] = useState('Our Marae');
  const [entities, setEntities] = useState([]);
  const [contacts, setContacts] = useState({});   // advisors only: accountant, lawyer
  const [maraePhone, setMaraePhone] = useState('');
  const [maraeEmail, setMaraeEmail] = useState('');
  const [maraeLocation, setMaraeLocation] = useState('');
  const [toolsConfig, setToolsConfig] = useState([]);
  const [subCommittees, setSubCommittees] = useState([]);
  const [customTools, setCustomTools] = useState([]);

  useEffect(() => {
    async function load() {
      const [{ data: prof }, { data: meet }, { data: docs }, { data: settings }] = await Promise.all([
        supabase.from('profiles').select('full_name, role, email, title').neq('role', 'community').order('role'),
        supabase.from('meetings').select('id, title, meeting_date, meeting_type, chairperson, secretary, attendees, apologies, minutes').order('meeting_date', { ascending: false }),
        supabase.from('documents').select('id, title, category, file_url, file_name, notes, created_at').is('deleted_at', null).order('created_at', { ascending: false }),
        supabase.from('marae_settings').select('*').limit(1).single(),
      ]);
      setProfiles(prof || []);
      setMeetings(meet || []);
      setDocuments(docs || []);
      if (settings?.marae_name) setMaraeName(settings.marae_name);
      if (settings?.entities) setEntities(settings.entities || []);
      if (settings?.contacts) setContacts(settings.contacts || {});
      if (settings?.phone) setMaraePhone(settings.phone);
      if (settings?.email) setMaraeEmail(settings.email);
      if (settings?.location) setMaraeLocation(settings.location);
      if (settings?.tools_config) setToolsConfig(settings.tools_config || []);
      if (settings?.sub_committees) setSubCommittees(settings.sub_committees || []);
      if (settings?.custom_tools) setCustomTools(settings.custom_tools || []);
      setLoading(false);
    }
    load();
  }, []);

  const upcoming = meetings.filter(m => isUpcoming(m.meeting_date)).sort((a, b) => new Date(a.meeting_date) - new Date(b.meeting_date));
  const past = meetings.filter(m => !isUpcoming(m.meeting_date)).slice(0, 5);

  const docsByCategory = documents.reduce((acc, d) => {
    const cat = d.category || 'General';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(d);
    return acc;
  }, {});

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>
      Loading {maraeName}…
    </div>
  );

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '24px 16px' }}>

      {/* Header */}
      <div style={{ marginBottom: 28, padding: '20px 24px', background: TEAL, borderRadius: 12, color: '#fff' }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>🏛️ {maraeName}</h1>
        <p style={{ margin: '6px 0 0', opacity: 0.85, fontSize: 14 }}>
          Your trustee reference page — team, tools, meetings, documents and processes.
        </p>
        {isAdmin && (
          <p style={{ margin: '8px 0 0', opacity: 0.7, fontSize: 12 }}>
            ✏️ Admin: update this page in <strong>Settings → Marae Profile</strong>
          </p>
        )}
      </div>

      {/* ORG CHART */}
      <SECTION icon="🗂️" title="Organisational Structure">
        <OrgChart
          maraeName={maraeName}
          entities={entities}
          subCommittees={subCommittees}
          trustees={profiles}
        />
      </SECTION>

      {/* OUR TEAM */}
      <SECTION icon="👥" title="Our Team">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
          {profiles.length === 0 && <p style={{ color: 'var(--text2)', fontSize: 14 }}>No trustees found.</p>}
          {profiles.map((p, i) => {
            const rc = ROLE_COLORS[p.role] || ROLE_COLORS.trustee;
            return (
              <CARD key={i}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{p.full_name || '—'}</div>
                {p.title && (
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand)', marginBottom: 4 }}>{p.title}</div>
                )}
                {!p.title && <PILL label={rc.label} bg={rc.bg} color={rc.color} />}
                {p.email && (
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 6, wordBreak: 'break-all' }}>
                    {p.email}
                  </div>
                )}
              </CARD>
            );
          })}
        </div>
      </SECTION>

      {/* ENTITIES */}
      {entities.length > 0 && (
        <SECTION icon="🏛️" title="Our Legal Entities">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
            {entities.map((ent, i) => (
              <CARD key={i}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{ent.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>{ENTITY_TYPE_LABELS[ent.type] || ent.type}</div>
                {ent.reg_number && <div style={{ fontSize: 12, marginBottom: 2 }}>📄 Reg: <strong>{ent.reg_number}</strong></div>}
                {ent.charities_number && <div style={{ fontSize: 12 }}>💛 Charities: <strong>{ent.charities_number}</strong></div>}
              </CARD>
            ))}
          </div>
        </SECTION>
      )}

      {/* KEY CONTACTS — built from single sources; no duplicate storage */}
      {(() => {
        const chairman = profiles.find(p => p.title?.toLowerCase().includes('chair'));
        const secretary = profiles.find(p => p.title?.toLowerCase().includes('secretary'));
        const hasAny = maraePhone || maraeEmail || maraeLocation || chairman || secretary || contacts.accountant || contacts.lawyer;
        if (!hasAny) return null;
        return (
          <SECTION icon="📞" title="Key Contacts">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
              {maraePhone    && <CARD><div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 2 }}>Main Phone</div><div style={{ fontSize: 13, fontWeight: 600 }}>{maraePhone}</div></CARD>}
              {maraeEmail && maraeEmail !== chairman?.email && <CARD><div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 2 }}>General Email</div><div style={{ fontSize: 13, fontWeight: 600, wordBreak: 'break-all' }}>{maraeEmail}</div></CARD>}
              {maraeLocation && <CARD><div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 2 }}>Location</div><div style={{ fontSize: 13, fontWeight: 600 }}>{maraeLocation}</div></CARD>}
              {chairman      && <CARD><div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 2 }}>Chairman</div><div style={{ fontSize: 13, fontWeight: 600 }}>{chairman.full_name}</div>{chairman.email && <div style={{ fontSize: 12, wordBreak: 'break-all', color: 'var(--text2)' }}>{chairman.email}</div>}</CARD>}
              {secretary     && <CARD><div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 2 }}>Secretary</div><div style={{ fontSize: 13, fontWeight: 600 }}>{secretary.full_name}</div>{secretary.email && <div style={{ fontSize: 12, wordBreak: 'break-all', color: 'var(--text2)' }}>{secretary.email}</div>}</CARD>}
              {contacts.accountant && <CARD><div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 2 }}>Accountant</div><div style={{ fontSize: 13, fontWeight: 600 }}>{contacts.accountant}</div></CARD>}
              {contacts.lawyer     && <CARD><div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 2 }}>Lawyer</div><div style={{ fontSize: 13, fontWeight: 600 }}>{contacts.lawyer}</div></CARD>}
            </div>
          </SECTION>
        );
      })()}

      {/* OUR TOOLS */}
      <SECTION icon="🛠️" title="Our Digital Tools — Right Tool, Right Job">
        {toolsConfig.length === 0 && customTools.length === 0 ? (
          <CARD><p style={{ margin: 0, color: 'var(--text2)', fontSize: 14 }}>No tools configured yet — Admin can set this up in Settings → Marae Profile.</p></CARD>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
            {toolsConfig.map(key => {
              const t = ALL_TOOLS[key]; if (!t) return null;
              return (
                <CARD key={key} style={{ borderTop: `4px solid ${t.textColor}` }}>
                  <div style={{ fontSize: 20, marginBottom: 6 }}>{t.emoji}</div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: t.textColor, marginBottom: 2 }}>{t.name}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{t.job}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>Managed by: <strong>{t.who}</strong></div>
                  <div style={{ fontSize: 11, color: '#a63020' }}>✗ Not for: {t.notFor}</div>
                </CARD>
              );
            })}
            {customTools.filter(ct => ct.name).map((ct, i) => (
              <CARD key={`custom-${i}`} style={{ borderTop: '4px solid #64748b' }}>
                <div style={{ fontSize: 20, marginBottom: 6 }}>🔧</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#334155', marginBottom: 2 }}>{ct.name}</div>
                {ct.job && <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{ct.job}</div>}
                {ct.who && <div style={{ fontSize: 12, color: 'var(--text2)' }}>Managed by: <strong>{ct.who}</strong></div>}
              </CARD>
            ))}
          </div>
        )}
      </SECTION>

      {/* UPCOMING MEETINGS */}
      <SECTION icon="📅" title="Upcoming Meetings">
        {upcoming.length === 0 ? (
          <CARD><p style={{ margin: 0, color: 'var(--text2)', fontSize: 14 }}>No upcoming meetings recorded. Add them in the Minutes section.</p></CARD>
        ) : (
          upcoming.map((m, i) => (
            <CARD key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{m.title}</div>
                <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>{formatDate(m.meeting_date)}</div>
              </div>
              <PILL label={m.meeting_type || 'Meeting'} />
            </CARD>
          ))
        )}
      </SECTION>

      {/* RECENT DECISIONS */}
      <SECTION icon="📋" title="Recent Decisions">
        {past.length === 0 ? (
          <CARD><p style={{ margin: 0, color: 'var(--text2)', fontSize: 14 }}>No past meeting minutes yet. Full minutes are in the Minutes section.</p></CARD>
        ) : (
          past.map((m, i) => (
            <CARD key={i}>
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', flexWrap: 'wrap', gap: 8 }}
                onClick={() => setExpandedMeeting(expandedMeeting === m.id ? null : m.id)}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{m.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
                    {formatDate(m.meeting_date)}
                    {m.chairperson && ` · Chair: ${m.chairperson}`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <PILL label={m.meeting_type || 'Meeting'} />
                  <span style={{ fontSize: 13, color: TEAL, fontWeight: 600 }}>{expandedMeeting === m.id ? '▲ Hide' : '▼ View'}</span>
                </div>
              </div>
              {expandedMeeting === m.id && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #e5e7eb' }}>
                  {m.attendees && (
                    <div style={{ marginBottom: 10 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>PRESENT: </span>
                      <span style={{ fontSize: 13 }}>{m.attendees}</span>
                    </div>
                  )}
                  {m.apologies && (
                    <div style={{ marginBottom: 10 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>APOLOGIES: </span>
                      <span style={{ fontSize: 13 }}>{m.apologies}</span>
                    </div>
                  )}
                  {m.minutes ? (
                    <pre style={{
                      whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.7,
                      fontFamily: 'inherit', margin: 0, color: 'var(--text1)',
                      background: '#f8f9fa', borderRadius: 8, padding: 14,
                    }}>{m.minutes}</pre>
                  ) : (
                    <p style={{ color: 'var(--text2)', fontSize: 13, margin: 0 }}>Minutes not yet recorded.</p>
                  )}
                </div>
              )}
            </CARD>
          ))
        )}
      </SECTION>

      {/* DOCUMENTS */}
      <SECTION icon="📁" title="Documents">
        {Object.keys(docsByCategory).length === 0 ? (
          <CARD><p style={{ margin: 0, color: 'var(--text2)', fontSize: 14 }}>No documents uploaded yet. Use the Documents section to add files.</p></CARD>
        ) : (
          Object.entries(docsByCategory).map(([cat, docs]) => (
            <div key={cat} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>{cat}</div>
              {docs.map((d, i) => (
                <CARD key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{d.title}</div>
                    {d.notes && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{d.notes}</div>}
                  </div>
                  {d.file_url && (
                    <a href={d.file_url} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 13, color: TEAL, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                      📄 Open
                    </a>
                  )}
                </CARD>
              ))}
            </div>
          ))
        )}
      </SECTION>


    </div>
  );
}
