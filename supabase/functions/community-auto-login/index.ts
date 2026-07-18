import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const COMMUNITY_EMAIL = 'community@maraehub.com';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const json = (body: object, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  try {
    const communityLoginToken = Deno.env.get('COMMUNITY_LOGIN_TOKEN') ?? '';
    const { token } = await req.json();

    if (!communityLoginToken || token !== communityLoginToken) {
      return json({ error: 'Forbidden' }, 403);
    }

    const supabaseUrl    = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: COMMUNITY_EMAIL,
    });

    if (error || !data?.properties?.hashed_token) {
      return json({ error: error?.message || 'Could not generate sign-in link' }, 500);
    }

    return json({ token_hash: data.properties.hashed_token });

  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
