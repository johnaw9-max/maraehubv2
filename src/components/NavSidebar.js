import React, { useState, useEffect } from 'react';
import { getGettingStartedStatus } from '../lib/gettingStarted';

// 14yhc7kp9th Step 2: vertical left-column nav, trustee dashboard only.
// Deliberately a new, separate component rather than a restructured
// Header.js -- Header is also used by CommunityPortal.js (a different,
// flat `tabs` shape, horizontal top bar), and changing its internal
// layout would have changed that page's nav too, which was never part of
// this task's scope. Same groups/activeTab/setActiveTab data as before,
// zero logic changes -- see NAV_GROUPS in TrusteeDashboard.js for the
// real source of truth this renders.

const FOUNDER_EMAILS = ['johnaw9@gmail.com', 'waj@maraehub.co.nz'];

export default function NavSidebar({ profile, activeTab, setActiveTab, groups, isAdmin, onNavigate }) {
  const [gsStatus, setGsStatus] = useState(null);

  // Same real getGettingStartedStatus() source GettingStartedChecklist.js
  // used to use on Board View -- real total is 8 items, not a guessed
  // number. Genuinely moved here, not duplicated: the Board View instance
  // is removed (see TrusteeDashboard.js), so this renders the full
  // itemized list too, not just the summary bar -- otherwise the per-item
  // click-to-fix detail (which of the 8 items is still outstanding, and
  // where to go fix it) would be real information lost in the move.
  useEffect(() => {
    if (isAdmin) getGettingStartedStatus().then(setGsStatus);
  }, [isAdmin]);

  return (
    <div className="sidebar">
      {groups.map((group, gi) => (
        <React.Fragment key={gi}>
          {group.label && (
            <div className="sidebar-group-label">
              {group.icon && <span style={{ fontSize: 12, lineHeight: 1 }}>{group.icon}</span>}
              {group.label}
            </div>
          )}
          {group.tabs.map(tab => (
            <div
              key={tab.key}
              className={`sidebar-item ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </div>
          ))}
        </React.Fragment>
      ))}
      {FOUNDER_EMAILS.includes(profile?.email) && (
        <a
          href="/founder"
          className={`sidebar-item sidebar-founder ${window.location.pathname === '/founder' ? 'active' : ''}`}
          style={{ textDecoration: 'none' }}
        >
          Founder
        </a>
      )}

      {isAdmin && gsStatus && (
        <div className="sidebar-getting-started">
          {gsStatus.completed === gsStatus.total ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, color: '#fff' }}>
              <span>✅</span> Setup complete
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>Getting Started</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{gsStatus.completed} of {gsStatus.total}</span>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 8, height: 6, overflow: 'hidden', marginBottom: 10 }}>
                <div style={{ width: `${(gsStatus.completed / gsStatus.total) * 100}%`, height: '100%', background: 'var(--accent-light)', borderRadius: 8, transition: 'width 0.4s ease' }} />
              </div>
              <div>
                {gsStatus.items.map(item => (
                  <div
                    key={item.key}
                    onClick={() => onNavigate && onNavigate(item.navTo)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', cursor: 'pointer' }}
                  >
                    <span style={{
                      width: 15, height: 15, borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, fontWeight: 700,
                      background: item.done ? 'var(--accent-light)' : 'transparent',
                      color: item.done ? 'var(--brand)' : 'rgba(255,255,255,0.5)',
                      border: `1.5px solid ${item.done ? 'var(--accent-light)' : 'rgba(255,255,255,0.35)'}`,
                    }}>
                      {item.done ? '✓' : ''}
                    </span>
                    <span style={{
                      fontSize: 13,
                      color: item.done ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.85)',
                      textDecoration: item.done ? 'line-through' : 'none',
                    }}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
