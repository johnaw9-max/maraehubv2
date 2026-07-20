import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

    // Verify the caller is an admin trustee using their JWT
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

    const { trusteeId } = await req.json();
    if (!trusteeId || typeof trusteeId !== 'string') {
      return json({ error: 'trusteeId is required' }, 400);
    }
    if (trusteeId === user.id) {
      return json({ error: 'You cannot ban your own account' }, 400);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: targetProfile } = await adminClient
      .from('profiles')
      .select('id, role')
      .eq('id', trusteeId)
      .single();

    if (!targetProfile || targetProfile.role !== 'trustee') {
      return json({ error: 'Trustee not found' }, 404);
    }

    // ~100 years — effectively indefinite, but reversible (unlike deleting the user)
    const { error: banError } = await adminClient.auth.admin.updateUserById(trusteeId, {
      ban_duration: '876000h',
    });

    if (banError) {
      return json({ error: banError.message }, 400);
    }

    return json({ success: true });

  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
