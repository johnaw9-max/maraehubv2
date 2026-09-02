import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = [Deno.env.get('FRONTEND_URL') ?? '', 'http://localhost:3000'].filter(Boolean);

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? '';
  const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : (Deno.env.get('FRONTEND_URL') ?? '');
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

// Google Calendar integration (14yhc7knp50), Step 5 -- the real, first
// integration point. Manual, per-trustee, per-meeting: a trustee clicks
// "Add to my Google Calendar" on a specific meeting, syncing it to their
// own calendar only. Deliberately not automatic for every connected
// trustee on every meeting save -- confirmed decision, matches the
// standing "never auto-execute without real trustee approval" principle
// already used for the AI Reports roadmap, and keeps the blast radius of
// any real bug in this new code to one trustee's one click, not a
// background push to everyone.
//
// meeting_date is a plain `date` column with no time -- this always
// creates an honest all-day event, never a fabricated time.
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CALENDAR_EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
// Refresh a bit before the real expiry, not exactly at it, so a slow
// request doesn't race past expiry mid-call.
const REFRESH_BUFFER_MS = 60 * 1000;

serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const json = (body: object, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  const supabaseUrl    = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const anonKey        = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const clientId       = Deno.env.get('GOOGLE_CLIENT_ID') ?? '';
  const clientSecret   = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '';

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await callerClient.auth.getUser();
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);

    const { data: callerProfile } = await callerClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (callerProfile?.role !== 'trustee') {
      return json({ error: 'Trustee access required' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const { meetingId } = body;
    if (typeof meetingId !== 'string' || !meetingId.trim()) {
      return json({ error: 'meetingId is required' }, 400);
    }

    // ---- Step 1: does this trustee have an active connection at all? ----
    const { data: connection } = await adminClient
      .from('google_calendar_connections')
      .select('*')
      .eq('trustee_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (!connection) {
      return json({ error: 'not_connected', message: 'Connect your Google Calendar in Settings first.' }, 400);
    }

    // ---- Step 2: refresh the access token if it's expired (or about to be) ----
    let accessToken = connection.access_token;
    const expiresAt = new Date(connection.access_token_expires_at).getTime();
    if (Date.now() >= expiresAt - REFRESH_BUFFER_MS) {
      if (!connection.refresh_token) {
        await adminClient.from('google_calendar_connections').update({ status: 'expired' }).eq('id', connection.id);
        return json({ error: 'reconnect_required', message: 'Your Google Calendar connection has expired. Please reconnect in Settings.' }, 400);
      }

      const refreshRes = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: connection.refresh_token,
          client_id: clientId,
          client_secret: clientSecret,
        }).toString(),
      });

      if (!refreshRes.ok) {
        // A refresh failure here almost always means the trustee revoked
        // access from their Google Account directly, outside MaraeHub --
        // Google never tells us about that when it happens, only the next
        // real refresh attempt surfaces it. Mark expired rather than retry
        // silently with a token that will keep failing.
        console.error('[sync-hui-to-calendar] token refresh failed:', refreshRes.status);
        await adminClient.from('google_calendar_connections').update({ status: 'expired' }).eq('id', connection.id);
        return json({ error: 'reconnect_required', message: 'Your Google Calendar connection has expired. Please reconnect in Settings.' }, 400);
      }

      const refreshed = await refreshRes.json();
      accessToken = refreshed.access_token;
      await adminClient
        .from('google_calendar_connections')
        .update({
          access_token: accessToken,
          access_token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
          last_refreshed_at: new Date().toISOString(),
        })
        .eq('id', connection.id);
    }

    // ---- Step 3: load the real meeting ----
    const { data: meeting, error: meetingError } = await adminClient
      .from('meetings')
      .select('id, title, meeting_type, meeting_date')
      .eq('id', meetingId)
      .single();

    if (meetingError || !meeting) {
      return json({ error: 'Meeting not found' }, 404);
    }
    if (!meeting.meeting_date) {
      return json({ error: 'This meeting has no date set yet.' }, 400);
    }

    // Google Calendar all-day events use an exclusive end date -- a
    // single-day event's "end" is the day AFTER "start", not the same day.
    const startDate = meeting.meeting_date;
    const endDateObj = new Date(startDate + 'T00:00:00Z');
    endDateObj.setUTCDate(endDateObj.getUTCDate() + 1);
    const endDate = endDateObj.toISOString().slice(0, 10);

    const eventBody = {
      summary: meeting.title,
      description: `${meeting.meeting_type || 'Meeting'} — synced from MaraeHub.`,
      start: { date: startDate },
      end: { date: endDate },
    };

    // ---- Step 4: has this meeting already been synced to this trustee's calendar? ----
    const { data: existingSync } = await adminClient
      .from('meeting_calendar_syncs')
      .select('id, google_event_id')
      .eq('meeting_id', meetingId)
      .eq('trustee_id', user.id)
      .maybeSingle();

    const calendarRes = await fetch(
      existingSync ? `${GOOGLE_CALENDAR_EVENTS_URL}/${existingSync.google_event_id}` : GOOGLE_CALENDAR_EVENTS_URL,
      {
        method: existingSync ? 'PATCH' : 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventBody),
      }
    );

    if (!calendarRes.ok) {
      console.error('[sync-hui-to-calendar] calendar API call failed:', calendarRes.status, await calendarRes.text());
      return json({ error: 'Could not reach Google Calendar. Please try again.' }, 502);
    }

    const calendarEvent = await calendarRes.json();

    if (existingSync) {
      await adminClient
        .from('meeting_calendar_syncs')
        .update({ synced_at: new Date().toISOString() })
        .eq('id', existingSync.id);
    } else {
      await adminClient
        .from('meeting_calendar_syncs')
        .insert({ meeting_id: meetingId, trustee_id: user.id, google_event_id: calendarEvent.id });
    }

    return json({ synced: true, googleEventId: calendarEvent.id, updated: !!existingSync });

  } catch (err) {
    console.error('[sync-hui-to-calendar] unexpected error:', (err as Error).message);
    return json({ error: (err as Error).message }, 500);
  }
});
