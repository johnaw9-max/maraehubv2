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

    const { fullName, email, committeeRole, permissionLevel } = await req.json();

    if (!fullName?.trim())        return json({ error: 'Full name is required' }, 400);
    if (!email?.includes('@'))    return json({ error: 'A valid email address is required' }, 400);

    // Generate a temporary password: "Marae" + 8 random alphanumeric chars
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let tempPassword = 'Marae';
    for (let i = 0; i < 8; i++) {
      tempPassword += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: fullName.trim(),
        committee_role: committeeRole || 'Trustee',
      },
    });

    if (createError) {
      return json({ error: createError.message }, 400);
    }

    // Upsert trustee profile
    await adminClient.from('profiles').upsert({
      id: created.user.id,
      email: email.trim().toLowerCase(),
      full_name: fullName.trim(),
      role: 'trustee',
      trustee_role: permissionLevel === 'admin' ? 'admin' : 'standard',
    }, { onConflict: 'id' });

    return json({ success: true, tempPassword, userId: created.user.id });

  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
