import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { isResolutionOpen } from '../lib/resolutionStatus';

// Chairing reference view, not a note-taking tool (Option C, real hui-practice
// investigation, 2026-09-12). The real workflow this app already assumed --
// see the existing "Draft from Hui Notes" AI feature in CommitteeMinutes.js --
// is rough/paper notes during the hui, formalised afterward. This screen is a
// distraction-free, glance-from-across-the-room reference for the chair
// during the hui itself: what's outstanding from before, and what the
// existing minutes already say. It is deliberately read-only -- no editing
// happens here; recording still happens through the normal Minutes screens.
//
// No new tables/migrations -- pure read view over meetings/resolutions/
// meeting_actions. Not entity-scoped: resolutions/meeting_actions have no
// entity_id column of their own (only meeting_id), and the closest existing
// precedent, the Decision Register, is already marae-wide, not per-entity --
// matched that rather than inventing a scoping rule the data doesn't support.
// No real-time subscription -- manual refresh only, a deliberately simple
// first build.

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + 'T12:00:00').toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function HuiModeView({ meetingId, onExit }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [meeting, setMeeting] = useState(null);
  const [resolutions, setResolutions] = useState([]);
  const [actions, setActions] = useState([]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');
    const [meetingRes, resRes, actRes] = await Promise.all([
      supabase.from('meetings').select('*').eq('id', meetingId).single(),
      supabase.from('resolutions').select('*').order('date_passed', { ascending: false }),
      supabase.from('meeting_actions').select('*').neq('status', 'Completed').order('due_date', { ascending: true }),
    ]);
    if (meetingRes.error) {
      setError('Could not load this meeting.');
      setLoading(false);
      return;
    }
    setMeeting(meetingRes.data);
    setResolutions((resRes.data || []).filter(r => isResolutionOpen(r.status)));
    setActions(actRes.data || []);
    setLoading(false);
  }, [meetingId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const today = new Date().toISOString().split('T')[0];

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: 18, color: '#7a7268' }}>
        Loading Hui Mode…
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 16 }}>
        <div style={{ fontSize: 16, color: '#a63020' }}>{error || 'Meeting not found.'}</div>
        <button onClick={onExit} style={{ padding: '10px 24px', background: '#1a4a3a', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 15 }}>
          ✕ Exit Hui Mode
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#faf8f5', padding: '24px 32px', fontFamily: 'DM Sans, sans-serif' }}>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 32, margin: 0, color: '#1a4a3a' }}>{meeting.title}</h1>
          <div style={{ fontSize: 18, color: '#4a4238', marginTop: 6 }}>
            {meeting.meeting_type ? `${meeting.meeting_type} · ` : ''}{fmtDate(meeting.meeting_date)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={fetchAll}
            style={{ padding: '10px 20px', background: 'none', color: '#1a4a3a', border: '1px solid #c8bfae', borderRadius: 8, cursor: 'pointer', fontSize: 15 }}
          >
            🔄 Refresh
          </button>
          <button
            onClick={onExit}
            style={{ padding: '10px 20px', background: '#1a4a3a', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 15 }}
          >
            ✕ Exit Hui Mode
          </button>
        </div>
      </div>

      {/* MEETING DETAILS */}
      <div style={{ background: '#fff', borderRadius: 12, padding: '18px 24px', marginBottom: 24, display: 'flex', flexWrap: 'wrap', gap: '10px 40px', fontSize: 16 }}>
        {meeting.chairperson && <div><strong>Chair:</strong> {meeting.chairperson}</div>}
        {meeting.secretary && <div><strong>Secretary:</strong> {meeting.secretary}</div>}
        {meeting.attendees && <div><strong>Attendees:</strong> {meeting.attendees}</div>}
        {meeting.apologies && <div><strong>Apologies:</strong> {meeting.apologies}</div>}
      </div>

      {/* EXISTING MINUTES (read-only reference) */}
      {meeting.minutes?.trim() && (
        <div style={{ background: '#fff', borderRadius: 12, padding: '18px 24px', marginBottom: 24 }}>
          <h2 style={{ fontSize: 20, color: '#1a4a3a', marginTop: 0, marginBottom: 10 }}>📝 Existing Minutes</h2>
          <div style={{ fontSize: 16, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: '#2a2620' }}>{meeting.minutes}</div>
        </div>
      )}

      {/* OUTSTANDING RESOLUTIONS + OPEN ACTIONS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 24 }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: '18px 24px' }}>
          <h2 style={{ fontSize: 20, color: '#1a4a3a', marginTop: 0, marginBottom: 14 }}>⚖️ Outstanding Resolutions ({resolutions.length})</h2>
          {resolutions.length === 0 ? (
            <div style={{ fontSize: 15, color: '#8a8276' }}>None outstanding.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {resolutions.map(r => (
                <div key={r.id} style={{ borderLeft: '3px solid #c8902a', paddingLeft: 14 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#2a2620' }}>
                    {r.resolution_number ? `${r.resolution_number} — ` : ''}{r.description}
                  </div>
                  <div style={{ fontSize: 13, color: '#8a8276', marginTop: 2 }}>
                    {r.status} · {fmtDate(r.date_passed)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ background: '#fff', borderRadius: 12, padding: '18px 24px' }}>
          <h2 style={{ fontSize: 20, color: '#1a4a3a', marginTop: 0, marginBottom: 14 }}>✅ Open Actions ({actions.length})</h2>
          {actions.length === 0 ? (
            <div style={{ fontSize: 15, color: '#8a8276' }}>None open.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {actions.map(a => {
                const overdue = a.due_date && a.due_date < today;
                return (
                  <div key={a.id} style={{ borderLeft: `3px solid ${overdue ? '#a63020' : '#c8bfae'}`, paddingLeft: 14 }}>
                    <div style={{ fontSize: 16, fontWeight: 600, color: '#2a2620' }}>{a.description}</div>
                    <div style={{ fontSize: 13, color: overdue ? '#a63020' : '#8a8276', marginTop: 2 }}>
                      {a.assigned_to || 'Unassigned'} · Due {fmtDate(a.due_date)}{overdue ? ' — OVERDUE' : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
