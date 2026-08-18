import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Real, root fix for the founder Tineka session gap (86d40pp1u, and the
// 18 Aug feedback/ux_pulse investigation that reconfirmed it). The
// founder has a real, dormant auth.users account on Tineka but no way
// to ever actually sign into it, so supabaseTineka (src/lib/supabaseMulti.js)
// has never had a real session -- every RLS-gated read through it
// silently returns empty, no error.
//
// Deployed on Opeke only -- called FROM the founder's real, working
// Opeke session. Same security shape as get-trustee-login-activity:
// verify caller JWT, authorize via FOUNDER_EMAILS (no profiles row
// exists to check a role against, on either project), then a
// privileged, service-role-mediated action -- here, minting a real
// Tineka session for the founder's own Tineka account, using
// TINEKA_SERVICE_ROLE_KEY (a Deno secret, server-side only, never
// exposed to the browser). Only ever mints a session for the caller's
// own email, matched on both projects -- not a general cross-project
// impersonation mechanism.

const FOUNDER_EMAILS = ['johnaw9@gmail.com', 'waj@maraehub.co.nz'];
const TINEKA_URL = 'https://zfefukxaliuximizjkwa.supabase.co';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const json = (body: object, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  try {
    const supabaseUrl    = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey        = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const tinekaAnonKey  = Deno.env.get('TINEKA_ANON_KEY') ?? '';
    const tinekaSecret   = Deno.env.get('TINEKA_SERVICE_ROLE_KEY') ?? '';
    const authHeader     = req.headers.get('Authorization') ?? '';

    // Verify the caller via their real Opeke JWT (same first step as
    // ban-trustee/get-trustee-login-activity).
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await callerClient.auth.getUser();
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);

    if (!FOUNDER_EMAILS.includes(user.email ?? '')) {
      return json({ error: 'Founder access required' }, 403);
    }

    // Mint a real Tineka session for the founder's own Tineka account --
    // generate a magic link server-side, then immediately exchange it
    // for a real access_token/refresh_token pair, without ever emailing
    // it or exposing the Tineka service-role key to the browser.
    const tinekaAdmin = createClient(TINEKA_URL, tinekaSecret);
    const { data: linkData, error: linkError } = await tinekaAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: user.email ?? '',
    });
    if (linkError || !linkData?.properties?.hashed_token) {
      return json({ error: linkError?.message || 'Could not generate Tineka session' }, 400);
    }

    const verifyRes = await fetch(`${TINEKA_URL}/auth/v1/verify`, {
      method: 'POST',
      headers: { apikey: tinekaAnonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'magiclink', token_hash: linkData.properties.hashed_token }),
    });
    const session = await verifyRes.json();
    if (!verifyRes.ok || !session.access_token) {
      return json({ error: session?.message || 'Could not verify Tineka session' }, 400);
    }

    return json({ access_token: session.access_token, refresh_token: session.refresh_token });

  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
