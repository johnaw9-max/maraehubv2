import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM_ADDRESS   = Deno.env.get('FROM_EMAIL') ?? 'MaraeHub <notifications@maraehub.co.nz>';
const SUPABASE_URL   = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON  = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const cors = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  // ── Auth: require a valid signed session JWT ──────────────────────────────
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');

  if (!token) {
    return new Response(
      JSON.stringify({ error: 'Missing Authorization header' }),
      { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    console.warn('send-notification: rejected unauthenticated request');
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  }
  // ─────────────────────────────────────────────────────────────────────────

  try {
    const { to, subject, body } = await req.json();

    if (!to || !subject || !body) {
      return new Response(
        JSON.stringify({ error: 'to, subject, and body are required' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } },
      );
    }

    console.log(`send-notification: user=${user.id} FROM_ADDRESS="${FROM_ADDRESS}" to=${JSON.stringify(to)} subject="${subject}"`);

    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'RESEND_API_KEY is not set' }),
        { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } },
      );
    }

    const recipients = Array.isArray(to) ? to.filter(Boolean) : [to];
    if (recipients.length === 0) {
      return new Response(
        JSON.stringify({ skipped: true, reason: 'no recipients' }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } },
      );
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM_ADDRESS, to: recipients, subject, text: body }),
    });

    const data = await res.json();

    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: data }),
        { status: res.status, headers: { ...cors, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, id: data.id }),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  }
});
