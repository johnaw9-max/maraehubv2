import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function Header({ profile, onLogout, activeTab, setActiveTab, tabs, groups }) {
  const [maraeName, setMaraeName] = useState('Te Marae o Tainui');
  const [maraeLocation, setMaraeLocation] = useState('Manurewa, Auckland');

  useEffect(() => {
    supabase.from('marae_settings').select('marae_name, location').limit(1).single()
      .then(({ data }) => {
        if (data) {
          if (data.marae_name) setMaraeName(data.marae_name);
          if (data.location) setMaraeLocation(data.location);
        }
      });
  }, []);

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase()
    : '?';

  return (
    <>
      <div className="header">
        <div className="header-left">
          <div className="logo-mark">M</div>
          <div>
            <div className="site-name">MaraeHub</div>
            <div className="site-sub">Operational Platform</div>
          </div>
        </div>
        <div className="header-right">
          <div>
            <div className="marae-name">{maraeName}</div>
            <div className="marae-loc">{maraeLocation}</div>
          </div>
          <div className="avatar">{initials}</div>
          <div className="role-badge" style={{ textTransform: 'capitalize' }}>{profile?.role}</div>
          <button className="logout-btn" onClick={onLogout}>Sign Out</button>
        </div>
      </div>

      {groups ? (
        <div className="nav">
          {groups.map((group, gi) => (
            <React.Fragment key={gi}>
              {group.label && (
                <div className="nav-group-label">{group.label}</div>
              )}
              {group.tabs.map(tab => (
                <div
                  key={tab.key}
                  className={`nav-item ${activeTab === tab.key ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
      ) : tabs ? (
        <div className="nav">
          {tabs.map(tab => (
            <div
              key={tab.key}
              className={`nav-item ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}
