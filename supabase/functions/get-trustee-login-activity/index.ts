import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Real fix for 86d40pp1u. get_trustee_login_activity() was correctly
// locked to service_role only (20260812000002, closing a confirmed
// PII exposure on real production) -- FounderDashboard.js's direct
// anon-key RPC call has been broken ever since. This mediates it.
//
// Deviates from ban-trustee/create-trustee's pattern in one real way:
// those check callerProfile.role/trustee_role via a profiles table
// lookup. The founder has zero profiles row on either project
// (confirmed directly) -- there is nothing to look up. Authorization
// here checks the JWT's own email claim against a hardcoded founder
// allowlist instead, matching FounderDashboard.js's own FOUNDER_EMAILS
// list, kept in sync deliberately, checked server-side so the
// client-side check is never the only gate.

const FOUNDER_EMAILS = ['johnaw9@gmail.com', 'waj@maraehub.co.nz'];

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
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const anonKey        = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const authHeader     = req.headers.get('Authorization') ?? '';

    // Verify the caller via their own JWT (same first step as ban-trustee).
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await callerClient.auth.getUser();
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);

    // No profiles row exists for the founder on either project --
    // authorize on the JWT's own email claim instead of a role lookup.
    if (!FOUNDER_EMAILS.includes(user.email ?? '')) {
      return json({ error: 'Founder access required' }, 403);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await adminClient.rpc('get_trustee_login_activity');
    if (error) return json({ error: error.message }, 400);

    return json({ trustees: data ?? [] });

  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
