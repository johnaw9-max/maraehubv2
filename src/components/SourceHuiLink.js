import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useOpenHui } from '../lib/OpenHuiContext';

// A quiet "from the minutes" link on an item that came from a hui. One tap opens that hui.
// Renders nothing when there is no source, or the hui can no longer be found.
const cache = new Map(); // key -> Promise<{ id, title, meeting_date } | null>

function loadHui({ meetingId, actionId }) {
  const key = meetingId ? `m:${meetingId}` : actionId ? `a:${actionId}` : null;
  if (!key) return null;
  if (!cache.has(key)) {
    cache.set(key, (async () => {
      let id = meetingId;
      if (!id && actionId) {
        const { data: act } = await supabase.from('meeting_actions').select('meeting_id').eq('id', actionId).maybeSingle();
        id = act?.meeting_id || null;
      }
      if (!id) return null;
      const { data } = await supabase.from('meetings').select('id, title, meeting_date').eq('id', id).maybeSingle();
      return data || null;
    })());
  }
  return cache.get(key);
}

export function parseSourceMeeting(description) {
  const m = (description || '').match(/\[source_meeting:([^\]]+)\]/);
  return m ? m[1] : null;
}

export default function SourceHuiLink({ meetingId, actionId, style }) {
  const openHui = useOpenHui();
  const [hui, setHui] = useState(null);

  useEffect(() => {
    let alive = true;
    const p = loadHui({ meetingId, actionId });
    if (p) p.then(h => { if (alive) setHui(h); }).catch(() => {});
    return () => { alive = false; };
  }, [meetingId, actionId]);

  if (!hui || !openHui) return null;
  const when = hui.meeting_date ? ` (${new Date(hui.meeting_date + 'T12:00:00').toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })})` : '';
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); openHui(hui.id); }}
      title="Open these minutes"
      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--brand)', fontSize: 12, fontFamily: 'inherit', textAlign: 'left', ...style }}
    >
      📄 From the minutes: {hui.title}{when} →
    </button>
  );
}
