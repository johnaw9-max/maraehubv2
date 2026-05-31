import React from 'react';

export default function Header({ profile, onLogout, activeTab, setActiveTab, tabs }) {
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
            <div className="marae-name">Te Marae o Tainui</div>
            <div className="marae-loc">Manurewa, Auckland</div>
          </div>
          <div className="avatar">{initials}</div>
          <div className="role-badge" style={{ textTransform: 'capitalize' }}>{profile?.role}</div>
          <button className="logout-btn" onClick={onLogout}>Sign Out</button>
        </div>
      </div>

      {tabs && (
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
      )}
    </>
  );
}
