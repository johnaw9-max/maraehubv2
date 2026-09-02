import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Access-Control-Allow-Origin can only ever be one literal value per response
// (never a list, never safe as '*' for authenticated requests) — so allow a
// small allowlist and echo back whichever one the actual request came from,
// rather than hardcoding a single production origin that breaks local testing.
const ALLOWED_ORIGINS = [Deno.env.get('FRONTEND_URL') ?? '', 'http://localhost:3000'].filter(Boolean);

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? '';
  const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : (Deno.env.get('FRONTEND_URL') ?? '');
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

// Google Calendar integration (14yhc7knp50), Step 4 — same shape as
// xero-callback throughout this file, adapted for a real difference: Xero
// is one connection per marae/entity, admin-trustee-gated. Calendar is one
// connection per TRUSTEE — each trustee authorizes their own account, any
// trustee can do it (personal integration, not marae-wide finance data), so
// there is no admin_role gate here.
const GOOGLE_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL     = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL  = 'https://www.googleapis.com/oauth2/v2/userinfo';
// Narrow scope, matching the OAuth consent screen configured in Step 2 --
// only calendar.events, nothing broader.
const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/calendar.events';
const STATE_TTL_MS = 10 * 60 * 1000;

// -- Signed, self-contained OAuth state (no DB row needed for CSRF protection) --
// Identical implementation to xero-callback's -- copied, not imported, to
// keep each Edge Function independently deployable with no shared module.

function base64urlEncode(bytes: Uint8Array): string {
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str: string): Uint8Array {
  const pad = (4 - (str.length % 4)) % 4;
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/').padEnd(str.length + pad, '='));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

interface StatePayload {
  userId: string;
  confirmed: boolean;
  nonce: string;
  exp: number;
}

async function signState(payload: StatePayload, secret: string): Promise<string> {
  const payloadB64 = base64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), new TextEncoder().encode(payloadB64));
  return `${payloadB64}.${base64urlEncode(new Uint8Array(sig))}`;
}

async function verifyState(state: string, secret: string): Promise<StatePayload | null> {
  const parts = state.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  const valid = await crypto.subtle.verify(
    'HMAC',
    await hmacKey(secret),
    base64urlDecode(sigB64),
    new TextEncoder().encode(payloadB64),
  );
  if (!valid) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(payloadB64))) as StatePayload;
    if (typeof payload.exp !== 'number' || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const url = new URL(req.url);
  const json = (body: object, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  const supabaseUrl    = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const anonKey        = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const clientId       = Deno.env.get('GOOGLE_CLIENT_ID') ?? '';
  const clientSecret   = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '';
  const redirectUri    = Deno.env.get('GOOGLE_REDIRECT_URI') ?? '';
  const frontendUrl    = Deno.env.get('FRONTEND_URL') ?? '';
  const stateSecret    = serviceRoleKey; // doubles as HMAC key — never exposed to clients

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  // This app has no real path-based routing -- /settings in the URL means
  // nothing (confirmed: window.location.pathname is never read anywhere in
  // the frontend). The real navigation mechanism is a ?tab= query param,
  // read once on mount by TrusteeDashboard.js and matched against its own
  // valid tab keys. Without tab=settings here, the browser would land on
  // whatever tab the app defaults to, MaraeSettings.js would never mount,
  // and this whole banner/status flow below would silently never run --
  // real bug caught while building this, xero-callback's redirect has the
  // same gap (not fixed here, out of this function's scope, but real).
  const settingsRedirect = (params: Record<string, string>) =>
    `${frontendUrl}/?${new URLSearchParams({ tab: 'settings', ...params }).toString()}`;

  async function authenticateCaller(): Promise<{ user: { id: string } } | { error: Response }> {
    const authHeader = req.headers.get('Authorization') ?? '';
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await callerClient.auth.getUser();
    if (authError || !user) return { error: json({ error: 'Unauthorized' }, 401) };

    const { data: callerProfile } = await callerClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    // Any trustee, not admin-only -- this is a personal connection, not
    // marae-wide finance data like Xero.
    if (callerProfile?.role !== 'trustee') {
      return { error: json({ error: 'Trustee access required' }, 403) };
    }
    return { user };
  }

  // ---- Path A: initiate — GET ?action=authorize (called via authenticated fetch from Settings UI) ----
  if (url.searchParams.get('action') === 'authorize') {
    try {
      const auth = await authenticateCaller();
      if ('error' in auth) return auth.error;
      const { user } = auth;

      if (!clientId || !redirectUri) {
        return json({ error: 'Google Calendar integration is not configured' }, 500);
      }

      const confirm = url.searchParams.get('confirm') === 'true';

      const { data: existing } = await adminClient
        .from('google_calendar_connections')
        .select('google_email')
        .eq('trustee_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      // Reconnect requires an explicit confirm=true round-trip — never silently replace a live connection.
      if (existing && !confirm) {
        return json({ needsConfirmation: true, existingGoogleEmail: existing.google_email });
      }

      const state = await signState({
        userId: user.id,
        confirmed: !!existing && confirm,
        nonce: crypto.randomUUID(),
        exp: Date.now() + STATE_TTL_MS,
      }, stateSecret);

      const authorizeUrl = `${GOOGLE_AUTHORIZE_URL}?${new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: GOOGLE_SCOPES,
        // access_type=offline is required to get a refresh_token at all;
        // prompt=consent forces Google to re-issue one even on a repeat
        // authorization, rather than only on the very first ever consent.
        access_type: 'offline',
        prompt: 'consent',
        state,
      }).toString()}`;

      return json({ authorizeUrl });

    } catch (err) {
      return json({ error: (err as Error).message }, 500);
    }
  }

  // ---- Path C: disconnect — POST ?action=disconnect (any trustee, their own connection only) ----
  if (url.searchParams.get('action') === 'disconnect') {
    try {
      const auth = await authenticateCaller();
      if ('error' in auth) return auth.error;
      const { user } = auth;

      const { error: updateError } = await adminClient
        .from('google_calendar_connections')
        .update({ status: 'disconnected', access_token: null, refresh_token: null })
        .eq('trustee_id', user.id)
        .eq('status', 'active');

      if (updateError) return json({ error: updateError.message }, 500);

      return json({ disconnected: true });

    } catch (err) {
      return json({ error: (err as Error).message }, 500);
    }
  }

  // ---- Path D: status — GET ?action=status (any trustee, their own connection only) ----
  // The table has RLS enabled with zero policies (same lockdown as
  // xero_connections), so this is the only way the frontend can ever learn
  // whether the caller has a connection -- it cannot query the table directly.
  if (url.searchParams.get('action') === 'status') {
    try {
      const auth = await authenticateCaller();
      if ('error' in auth) return auth.error;
      const { user } = auth;

      const { data } = await adminClient
        .from('google_calendar_connections')
        .select('google_email, connected_at')
        .eq('trustee_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      return json({ connected: !!data, googleEmail: data?.google_email ?? null, connectedAt: data?.connected_at ?? null });

    } catch (err) {
      return json({ error: (err as Error).message }, 500);
    }
  }

  // ---- Path B: Google redirects the browser here with ?code=&state= (or ?error=) ----
  // Plain top-level navigation, not a fetch — no CORS headers apply or are sent.
  const redirect = (params: Record<string, string>) =>
    new Response(null, { status: 302, headers: { Location: settingsRedirect(params) } });

  if (!frontendUrl) {
    return json({ error: 'Google Calendar integration is not configured (FRONTEND_URL missing)' }, 500);
  }

  if (url.searchParams.get('error')) {
    return redirect({ google: 'error', reason: 'denied' });
  }

  const code  = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) {
    return redirect({ google: 'error', reason: 'missing_params' });
  }

  const statePayload = await verifyState(state, stateSecret);
  if (!statePayload) {
    return redirect({ google: 'error', reason: 'invalid_state' });
  }

  try {
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }).toString(),
    });

    if (!tokenRes.ok) {
      console.error('[google-calendar-callback] token exchange failed:', tokenRes.status);
      return redirect({ google: 'error', reason: 'token_exchange' });
    }

    const { access_token, refresh_token, expires_in, scope } = await tokenRes.json();

    // Google only returns refresh_token on the FIRST consent (even with
    // prompt=consent forcing re-issue on reconnect, this is the one real
    // failure mode worth naming): if a trustee revoked access from their
    // Google Account settings directly instead of through MaraeHub, our row
    // could still say 'active' while Google has no record of it -- the
    // very next real token refresh attempt (Step 5) is what will surface
    // that, not this callback, since Google doesn't tell us about revokes
    // that happen outside its own consent screen.
    if (!refresh_token) {
      console.error('[google-calendar-callback] no refresh_token in response — reconnect may be required later');
    }

    const userInfoRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { 'Authorization': `Bearer ${access_token}` },
    });
    const googleEmail = userInfoRes.ok ? (await userInfoRes.json()).email ?? null : null;

    const { data: existingAnyStatus } = await adminClient
      .from('google_calendar_connections')
      .select('id, refresh_token')
      .eq('trustee_id', statePayload.userId)
      .maybeSingle();

    // Defense in depth: only proceed with an overwrite if state carried an
    // explicit confirmation for this reconnect.
    if (existingAnyStatus && existingAnyStatus.refresh_token && !statePayload.confirmed) {
      return redirect({ google: 'needs_confirmation' });
    }

    const row = {
      trustee_id: statePayload.userId,
      google_email: googleEmail,
      access_token,
      // Keep the previous refresh_token if Google didn't send a new one
      // this time, rather than overwriting a real, working token with null.
      refresh_token: refresh_token || existingAnyStatus?.refresh_token || null,
      access_token_expires_at: new Date(Date.now() + expires_in * 1000).toISOString(),
      scope,
      status: 'active',
      connected_at: new Date().toISOString(),
    };

    const { error: writeError } = existingAnyStatus
      ? await adminClient.from('google_calendar_connections').update(row).eq('id', existingAnyStatus.id)
      : await adminClient.from('google_calendar_connections').insert(row);

    if (writeError) {
      console.error('[google-calendar-callback] db write failed:', writeError.message);
      return redirect({ google: 'error', reason: 'save_failed' });
    }

    return redirect({ google: 'connected' });

  } catch (err) {
    console.error('[google-calendar-callback] unexpected error:', (err as Error).message);
    return redirect({ google: 'error', reason: 'unexpected' });
  }
});
