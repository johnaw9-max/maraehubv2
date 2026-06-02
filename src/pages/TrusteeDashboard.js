import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Header from '../components/Header';
import BookingsManager from '../components/BookingsManager';
import ProjectsManager from '../components/ProjectsManager';
import AssetsManager from '../components/AssetsManager';
import DocumentsManager from '../components/DocumentsManager';
import NoticeboardManager from '../components/NoticeboardManager';
import CalendarView from '../components/CalendarView';
import MaraeSettings from '../components/MaraeSettings';
import UserManager from '../components/UserManager';

const TABS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'bookings', label: 'Bookings' },
  { key: 'calendar', label: 'Calendar' },
  { key: 'noticeboard', label: 'Noticeboard' },
  { key: 'projects', label: 'Projects' },
  { key: 'assets', label: 'Assets' },
  { key: 'documents', label: 'Documents' },
  { key: 'users', label: 'Users' },
  { key: 'settings', label: 'Settings' },
];

export default function TrusteeDashboard({ profile, onLogout }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState({ bookings: 0, projects: 0, assets: 0, pending: 0 });
  const [recentBookings, setRecentBookings] = useState([]);
  const [recentProjects, setRecentProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (activeTab === 'dashboard') fetchDashboardData();
  }, [activeTab]);

  async function fetchDashboardData() {
    setLoading(true);
    const [bookingsRes, projectsRes, assetsRes, pendingRes] = await Promise.all([
      supabase.from('bookings').select('*').order('created_at', { ascending: false }).limit(5),
      supabase.from('projects').select('*').order('created_at', { ascending: false }).limit(3),
      supabase.from('assets').select('id'),
      supabase.from('bookings').select('id').eq('status', 'pending'),
    ]);

    setRecentBookings(bookingsRes.data || []);
    setRecentProjects(projectsRes.data || []);
    setStats({
      bookings: (bookingsRes.data || []).length,
      projects: (projectsRes.data || []).length,
      assets: (assetsRes.data || []).length,
      pending: (pendingRes.data || []).length,
    });
    setLoading(false);
  }

  function formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  return (
    <div>
      <Header profile={profile} onLogout={onLogout} activeTab={activeTab} setActiveTab={setActiveTab} tabs={TABS} />

      <div className="main">
        {activeTab === 'dashboard' && (
          <>
            <div style={{ marginBottom: 24 }}>
              <h1 style={{ fontSize: 26, marginBottom: 4 }}>Tēnā koe, {profile?.full_name?.split(' ')[0]} 👋</h1>
              <p style={{ color: 'var(--text3)', fontSize: 13 }}>
                Welcome to your Trustee Dashboard · <em style={{ color: 'var(--brand)' }}>Ngā mihi nui ki a koutou katoa</em>
              </p>
            </div>

            {/* STAT TILES */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
              {[
                { label: 'Pending Bookings', val: stats.pending, icon: '📅', color: '#fdf0dc', iconColor: 'var(--warning)', action: () => setActiveTab('bookings') },
                { label: 'Active Projects', val: stats.projects, icon: '📋', color: '#e8eef8', iconColor: 'var(--info)', action: () => setActiveTab('projects') },
                { label: 'Assets Tracked', val: stats.assets, icon: '🏗️', color: '#f0ecf8', iconColor: '#6b42a8', action: () => setActiveTab('assets') },
                { label: 'Total Bookings', val: stats.bookings, icon: '📊', color: '#e8f4ef', iconColor: 'var(--success)', action: null },
              ].map((tile, i) => (
                <div
                  key={i}
                  className="panel"
                  style={{ textAlign: 'center', cursor: tile.action ? 'pointer' : 'default' }}
                  onClick={tile.action}
                >
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: tile.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, margin: '0 auto 10px' }}>{tile.icon}</div>
                  <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 28, fontWeight: 600 }}>{tile.val}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>{tile.label}</div>
                </div>
              ))}
            </div>

            {/* RECENT BOOKINGS */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
              <div className="panel">
                <div className="panel-header">
                  <div className="panel-title">Recent Booking Requests</div>
                  <span style={{ fontSize: 12, color: 'var(--brand-light)', cursor: 'pointer' }} onClick={() => setActiveTab('bookings')}>View All →</span>
                </div>
                {loading ? <div className="loading">Loading...</div> : recentBookings.length === 0 ? (
                  <div className="empty-state"><div className="emoji">📅</div><div>No bookings yet</div></div>
                ) : recentBookings.map(b => (
                  <div key={b.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--cream2)', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{b.occasion}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{formatDate(b.start_date)} · {b.guests} guests</div>
                    </div>
                    <span className={`badge badge-${b.status}`}>{b.status}</span>
                  </div>
                ))}
              </div>

              <div className="panel">
                <div className="panel-header">
                  <div className="panel-title">Active Projects</div>
                  <span style={{ fontSize: 12, color: 'var(--brand-light)', cursor: 'pointer' }} onClick={() => setActiveTab('projects')}>View All →</span>
                </div>
                {loading ? <div className="loading">Loading...</div> : recentProjects.length === 0 ? (
                  <div className="empty-state"><div className="emoji">📋</div><div>No projects yet</div></div>
                ) : recentProjects.map(p => (
                  <div key={p.id} style={{ padding: '12px', background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--cream2)', marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</div>
                      <span className={`badge badge-${p.status}`}>{p.status}</span>
                    </div>
                    <div style={{ height: 4, background: 'var(--cream2)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${p.progress}%`, background: 'var(--brand-light)', borderRadius: 2 }} />
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>{p.progress}% · Due {formatDate(p.due_date)}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {activeTab === 'bookings' && <BookingsManager isTrustee={true} />}
        {activeTab === 'calendar' && <CalendarView isTrustee={true} />}
        {activeTab === 'noticeboard' && <NoticeboardManager isTrustee={true} profile={profile} />}
        {activeTab === 'projects' && <ProjectsManager />}
        {activeTab === 'assets' && <AssetsManager />}
        {activeTab === 'documents' && <DocumentsManager />}
        {activeTab === 'users' && <UserManager />}
        {activeTab === 'settings' && <MaraeSettings />}
      </div>

      <div className="footer">MaraeHub NZ Ltd · maraehub.com · Serving urban Māori communities across Aotearoa</div>
    </div>
  );
}
