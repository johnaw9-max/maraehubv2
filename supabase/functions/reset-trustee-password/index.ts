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

    const { userId } = await req.json();
    if (!userId) return json({ error: 'userId is required' }, 400);

    // Prevent admin from resetting their own password via this route
    if (userId === user.id) {
      return json({ error: 'Use Settings → Change Password to update your own password' }, 400);
    }

    // Generate a new temporary password: "Marae" + 8 random alphanumeric chars
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let tempPassword = 'Marae';
    for (let i = 0; i < 8; i++) {
      tempPassword += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
      password: tempPassword,
    });

    if (updateError) return json({ error: updateError.message }, 400);

    return json({ success: true, tempPassword });

  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
