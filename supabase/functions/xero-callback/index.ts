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

const XERO_AUTHORIZE_URL   = 'https://login.xero.com/identity/connect/authorize';
const XERO_TOKEN_URL       = 'https://identity.xero.com/connect/token';
const XERO_CONNECTIONS_URL = 'https://api.xero.com/connections';
const XERO_SCOPES = 'offline_access accounting.reports.banksummary.read accounting.reports.profitandloss.read';
const STATE_TTL_MS = 10 * 60 * 1000;

// -- Signed, self-contained OAuth state (no DB row needed for CSRF protection) --

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
  entityId: string | null;
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
  const clientId       = Deno.env.get('XERO_CLIENT_ID') ?? '';
  const clientSecret   = Deno.env.get('XERO_CLIENT_SECRET') ?? '';
  const redirectUri    = Deno.env.get('XERO_REDIRECT_URI') ?? '';
  const frontendUrl    = Deno.env.get('FRONTEND_URL') ?? '';
  const stateSecret    = serviceRoleKey; // doubles as HMAC key — never exposed to clients

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const settingsRedirect = (params: Record<string, string>) =>
    `${frontendUrl}/settings?${new URLSearchParams(params).toString()}`;

  // ---- Path A: initiate — GET ?action=authorize (called via authenticated fetch from Settings UI) ----
  if (url.searchParams.get('action') === 'authorize') {
    try {
      const authHeader = req.headers.get('Authorization') ?? '';
      const callerClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: authError } = await callerClient.auth.getUser();
      if (authError || !user) return json({ error: 'Unauthorized' }, 401);

      const { data: callerProfile } = await callerClient
        .from('profiles')
        .select('role, trustee_role')
        .eq('id', user.id)
        .single();

      if (callerProfile?.role !== 'trustee' || callerProfile?.trustee_role !== 'admin') {
        return json({ error: 'Admin Trustee access required' }, 403);
      }

      if (!clientId || !redirectUri) {
        return json({ error: 'Xero integration is not configured' }, 500);
      }

      const entityId = url.searchParams.get('entity_id');
      const confirm  = url.searchParams.get('confirm') === 'true';

      let existingQuery = adminClient.from('xero_connections').select('tenant_name').eq('status', 'active');
      existingQuery = entityId ? existingQuery.eq('entity_id', entityId) : existingQuery.is('entity_id', null);
      const { data: existing } = await existingQuery.maybeSingle();

      // Reconnect requires an explicit confirm=true round-trip — never silently replace a live connection.
      if (existing && !confirm) {
        return json({ needsConfirmation: true, existingTenantName: existing.tenant_name });
      }

      const state = await signState({
        entityId: entityId || null,
        userId: user.id,
        confirmed: !!existing && confirm,
        nonce: crypto.randomUUID(),
        exp: Date.now() + STATE_TTL_MS,
      }, stateSecret);

      const authorizeUrl = `${XERO_AUTHORIZE_URL}?${new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: XERO_SCOPES,
        state,
      }).toString()}`;

      return json({ authorizeUrl });

    } catch (err) {
      return json({ error: (err as Error).message }, 500);
    }
  }

  // ---- Path C: disconnect — POST ?action=disconnect (admin-trustee only) ----
  if (url.searchParams.get('action') === 'disconnect') {
    try {
      const authHeader = req.headers.get('Authorization') ?? '';
      const callerClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: authError } = await callerClient.auth.getUser();
      if (authError || !user) return json({ error: 'Unauthorized' }, 401);

      const { data: callerProfile } = await callerClient
        .from('profiles')
        .select('role, trustee_role')
        .eq('id', user.id)
        .single();

      if (callerProfile?.role !== 'trustee' || callerProfile?.trustee_role !== 'admin') {
        return json({ error: 'Admin Trustee access required' }, 403);
      }

      const entityId = url.searchParams.get('entity_id');
      let updateQuery = adminClient
        .from('xero_connections')
        .update({ status: 'disconnected', access_token: null, refresh_token: null })
        .eq('status', 'active');
      updateQuery = entityId ? updateQuery.eq('entity_id', entityId) : updateQuery.is('entity_id', null);
      const { error: updateError } = await updateQuery;

      if (updateError) return json({ error: updateError.message }, 500);

      return json({ disconnected: true });

    } catch (err) {
      return json({ error: (err as Error).message }, 500);
    }
  }

  // ---- Path B: Xero redirects the browser here with ?code=&state= (or ?error=) ----
  // Plain top-level navigation, not a fetch — no CORS headers apply or are sent.
  const redirect = (params: Record<string, string>) =>
    new Response(null, { status: 302, headers: { Location: settingsRedirect(params) } });

  if (!frontendUrl) {
    return json({ error: 'Xero integration is not configured (FRONTEND_URL missing)' }, 500);
  }

  if (url.searchParams.get('error')) {
    return redirect({ xero: 'error', reason: 'denied' });
  }

  const code  = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) {
    return redirect({ xero: 'error', reason: 'missing_params' });
  }

  const statePayload = await verifyState(state, stateSecret);
  if (!statePayload) {
    return redirect({ xero: 'error', reason: 'invalid_state' });
  }

  try {
    const tokenRes = await fetch(XERO_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }).toString(),
    });

    if (!tokenRes.ok) {
      console.error('[xero-callback] token exchange failed:', tokenRes.status);
      return redirect({ xero: 'error', reason: 'token_exchange' });
    }

    const { access_token, refresh_token, expires_in, scope } = await tokenRes.json();

    const connectionsRes = await fetch(XERO_CONNECTIONS_URL, {
      headers: { 'Authorization': `Bearer ${access_token}` },
    });

    if (!connectionsRes.ok) {
      console.error('[xero-callback] connections lookup failed:', connectionsRes.status);
      return redirect({ xero: 'error', reason: 'tenant_lookup' });
    }

    const connections = await connectionsRes.json();
    if (!Array.isArray(connections) || connections.length !== 1) {
      // MVP: our data model is one tenant per connection — don't guess if the user granted access to several.
      return redirect({ xero: 'error', reason: 'select_one_org' });
    }
    const { tenantId, tenantName } = connections[0];

    const entityId = statePayload.entityId;
    let existingQuery = adminClient.from('xero_connections').select('id').eq('status', 'active');
    existingQuery = entityId ? existingQuery.eq('entity_id', entityId) : existingQuery.is('entity_id', null);
    const { data: existing } = await existingQuery.maybeSingle();

    // Defense in depth: only proceed if state carried an explicit confirmation for this reconnect.
    if (existing && !statePayload.confirmed) {
      return redirect({ xero: 'needs_confirmation' });
    }

    const row = {
      entity_id: entityId,
      tenant_id: tenantId,
      tenant_name: tenantName,
      access_token,
      refresh_token,
      access_token_expires_at: new Date(Date.now() + expires_in * 1000).toISOString(),
      scope,
      connected_by: statePayload.userId,
      status: 'active',
    };

    const { error: writeError } = existing
      ? await adminClient.from('xero_connections').update(row).eq('id', existing.id)
      : await adminClient.from('xero_connections').insert(row);

    if (writeError) {
      console.error('[xero-callback] db write failed:', writeError.message);
      return redirect({ xero: 'error', reason: 'save_failed' });
    }

    return redirect({ xero: 'connected' });

  } catch (err) {
    console.error('[xero-callback] unexpected error:', (err as Error).message);
    return redirect({ xero: 'error', reason: 'unexpected' });
  }
});
