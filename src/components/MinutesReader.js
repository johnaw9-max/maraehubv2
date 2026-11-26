import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { functionErrorMessage } from '../lib/functionErrorMessage';
import { groupByKind, saveSuggestion } from '../lib/minutesReader';

// Reads the approved minutes of one hui and lists what a trustee may want to add.
// The AI only suggests: each item shows the line it came from, and nothing is saved
// until a trustee ticks it and presses Save.

const KIND_ICONS = { task: '✅', risk: '⚠️', asset: '🔧', grant: '💰', decision: '📜' };
const KIND_PLURAL = { task: 'Jobs', risk: 'Risks', asset: 'Assets', grant: 'Grants', decision: 'Decisions' };
const KIND_DEST = { task: 'Task Board', risk: 'Risk Register', asset: 'Assets', grant: 'Grants', decision: 'this hui\'s Resolutions' };

function describe(s) {
  if (s.kind === 'task') {
    return `${s.description}${s.assigned_to ? ' — ' + s.assigned_to : ' — no owner stated'}${s.due_date ? ' (due ' + s.due_date + ')' : ''}`;
  }
  if (s.kind === 'risk') return s.description;
  if (s.kind === 'asset') return `${s.name}${s.notes ? ': ' + s.notes : ''}`;
  if (s.kind === 'grant') return `${s.name === s.funder ? s.funder : s.name + ' (' + s.funder + ')'}${s.amount != null ? ', $' + Number(s.amount).toLocaleString('en-NZ') : ''}${s.deadline ? ', deadline ' + s.deadline : ''}`;
  return s.description;
}

export default function MinutesReader({ meeting, minutes, maraeName, requestConsent, canSave, onSaved }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState(null); // null = not run yet
  const [ticked, setTicked] = useState({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState({});     // _id -> true once saved
  const [failed, setFailed] = useState({}); // _id -> message

  async function run() {
    const consented = await requestConsent();
    if (!consented) return;
    setLoading(true); setError(''); setSuggestions(null); setTicked({}); setDone({}); setFailed({});
    const { data, error: err } = await supabase.functions.invoke('extract-from-minutes', {
      body: { maraeName, minutes, meetingDate: meeting.meeting_date || null },
    });
    setLoading(false);
    if (err) {
      const msg = await functionErrorMessage(err, 'Could not reach the AI service');
      setError(msg === 'ai_auth_or_billing' ? "The AI service isn't available right now. The founder has been notified." : msg);
      return;
    }
    if (data?.error) { setError(data.error); return; }
    setSuggestions(data.suggestions || []);
  }

  const groups = suggestions ? groupByKind(suggestions) : [];
  const tickedItems = suggestions
    ? suggestions.map((s, i) => ({ ...s, _id: i })).filter(s => ticked[s._id] && !done[s._id])
    : [];

  async function saveTicked() {
    setSaving(true);
    const nextDone = { ...done };
    const nextFailed = {};
    for (const item of tickedItems) {
      const r = await saveSuggestion(item, meeting);
      if (r.ok) nextDone[item._id] = true; else nextFailed[item._id] = r.message;
    }
    setDone(nextDone); setFailed(nextFailed); setSaving(false);
    setTicked(t => { const n = { ...t }; Object.keys(nextDone).forEach(k => { delete n[k]; }); return n; });
    if (onSaved) onSaved();
  }

  return (
    <div className="panel" style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 16, fontWeight: 600 }}>🔎 Find risks, jobs and more in these minutes</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
            The AI suggests. You tick what to keep. Nothing is saved until you press Save.
          </div>
        </div>
        <button className="btn-secondary" style={{ fontSize: 12, flexShrink: 0 }} onClick={() => setOpen(o => !o)}>
          {open ? 'Hide' : 'Open'}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          {!suggestions && (
            <>
              <p style={{ fontSize: 13, color: 'var(--text2)', marginTop: 0 }}>
                This sends the minutes text of this hui to Anthropic's Claude service to find suggestions. It only runs when you press the button.
              </p>
              <button className="btn-primary" style={{ fontSize: 13 }} onClick={run} disabled={loading || !minutes}>
                {loading ? '⏳ Reading the minutes…' : '🔎 Read these minutes'}
              </button>
            </>
          )}
          {error && <div className="alert alert-error" style={{ marginTop: 10 }}>{error}</div>}

          {suggestions && suggestions.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>
              Nothing to suggest from these minutes. That can mean they are short or already fully recorded.
              <div style={{ marginTop: 8 }}><button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => setSuggestions(null)}>Read again</button></div>
            </div>
          )}

          {suggestions && suggestions.length > 0 && (
            <>
              {!canSave && (
                <div className="alert" style={{ marginBottom: 12, fontSize: 13 }}>
                  You can read the suggestions. Only an administrator or the Secretary can save them.
                </div>
              )}
              {groups.map(g => (
                <div key={g.kind} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                    {KIND_ICONS[g.kind]} {KIND_PLURAL[g.kind]} <span style={{ fontWeight: 400, color: 'var(--text3)' }}>→ {KIND_DEST[g.kind]}</span>
                  </div>
                  {g.items.map(s => (
                    <label key={s._id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 12px', background: done[s._id] ? '#e8f4ef' : 'var(--surface2)', borderRadius: 8, marginBottom: 6, cursor: canSave && !done[s._id] ? 'pointer' : 'default' }}>
                      <input
                        type="checkbox"
                        checked={!!ticked[s._id] || !!done[s._id]}
                        disabled={!canSave || !!done[s._id] || saving}
                        onChange={e => setTicked(t => ({ ...t, [s._id]: e.target.checked }))}
                        style={{ marginTop: 3 }}
                      />
                      <span style={{ flex: 1 }}>
                        <span style={{ fontSize: 13, display: 'block' }}>{describe(s)}</span>
                        {s.kind === 'risk' && (
                          <span style={{ fontSize: 12, color: 'var(--text3)', display: 'block' }}>
                            {s.category} · likelihood {s.likelihood}, consequence {s.consequence} (the AI's estimate, check it){s.controls ? ' · Controls: ' + s.controls : ''}
                          </span>
                        )}
                        <span style={{ fontSize: 12, color: 'var(--text3)', display: 'block', fontStyle: 'italic' }}>From the minutes: “{s.quote}”</span>
                        {done[s._id] && <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>Saved to {KIND_DEST[s.kind]}</span>}
                        {failed[s._id] && <span style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 600 }}>Could not save: {failed[s._id]}</span>}
                      </span>
                    </label>
                  ))}
                </div>
              ))}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <button className="btn-primary" style={{ fontSize: 13 }} onClick={saveTicked} disabled={!canSave || saving || tickedItems.length === 0}>
                  {saving ? 'Saving…' : `Save ${tickedItems.length} ticked`}
                </button>
                <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => { setSuggestions(null); setTicked({}); setDone({}); setFailed({}); }} disabled={saving}>
                  Start again
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
