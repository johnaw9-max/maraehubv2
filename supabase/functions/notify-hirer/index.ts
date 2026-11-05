// notify-hirer — the app's email function (Phase 1, item 1, P1-01).
//
// Before Phase 1 the app called this with the PUBLIC anon key, so anyone
// with the website's key could send any HTML email to anyone. It now:
//   • accepts only (a) a signed-in user's session for THIS project, or
//     (b) this project's secret key (public-booking-request, server-side);
//   • only sends to addresses this marae already holds:
//       – trustees and server callers: profiles, contacts, booking contacts
//       – everyone else (community members): trustee addresses only;
//   • sends plain text, never HTML (the app's bodies are plain text already;
//     previously their line breaks were lost because they were sent as HTML);
//   • caps recipients and emails per user per hour, and logs counts only.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isProjectSecretKey, extractKeys } from './auth.ts';

const RESEND_API_KEY   = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM_EMAIL       = Deno.env.get('FROM_EMAIL') ?? 'MaraeHub <onboarding@resend.dev>';
const SUPABASE_URL     = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const MAX_RECIPIENTS        = 50;
const MAX_SUBJECT           = 200;
const MAX_BODY              = 20000;
const MAX_EMAILS_PER_HOUR   = 60;   // per signed-in user, counted per recipient

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const norm = (e: unknown) => (typeof e === 'string' ? e.trim().toLowerCase() : '');

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  // ── 1. Who is calling? ─────────────────────────────────────────────────────
  const presented = extractKeys(req);
  let callerId: string | null = null;
  let trustedServer = false;
  let isTrustee = false;

  if (await isProjectSecretKey(presented)) {
    trustedServer = true;
  } else {
    const bearer = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data, error } = bearer ? await admin.auth.getUser(bearer) : { data: null, error: true };
    const user = (data as any)?.user;
    if (error || !user) {
      console.warn('[notify-hirer] refused call without a signed-in session');
      return json({ error: 'Unauthorized' }, 401);
    }
    callerId = user.id;
    const { data: prof } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle();
    isTrustee = prof?.role === 'trustee';
  }

  try {
    const { to, subject, body } = await req.json();

    if (!to || !subject || !body) return json({ error: 'Missing required fields: to, subject, body' }, 400);
    if (typeof subject !== 'string' || typeof body !== 'string') return json({ error: 'subject and body must be text' }, 400);
    if (subject.length > MAX_SUBJECT || body.length > MAX_BODY) return json({ error: 'subject or body too long' }, 400);

    const recipients = [...new Set((Array.isArray(to) ? to : [to]).map(norm).filter((e) => e.includes('@')))];
    if (recipients.length === 0) return json({ skipped: true, reason: 'no recipients' });
    if (recipients.length > MAX_RECIPIENTS) return json({ error: 'too many recipients' }, 400);

    if (!RESEND_API_KEY) {
      console.warn('[notify-hirer] RESEND_API_KEY not set');
      return json({ error: 'Email service not configured' }, 500);
    }

    // ── 2. Recipients must already be known to this marae ────────────────────
    const allowed = new Set<string>();
    const { data: profs } = await admin.from('profiles').select('email, role').not('email', 'is', null);
    for (const p of profs ?? []) {
      if (trustedServer || isTrustee || p.role === 'trustee') allowed.add(norm(p.email));
    }
    if (trustedServer || isTrustee) {
      const { data: contacts } = await admin.from('contacts').select('email').not('email', 'is', null);
      for (const c of contacts ?? []) allowed.add(norm(c.email));
      const { data: bookings } = await admin.from('bookings').select('contact_email').not('contact_email', 'is', null);
      for (const b of bookings ?? []) allowed.add(norm(b.contact_email));
    }
    const refused = recipients.filter((r) => !allowed.has(r));
    if (refused.length > 0) {
      console.warn(`[notify-hirer] refused ${refused.length} unknown recipient(s)`);
      return json({ error: 'One or more recipients are not known to this marae' }, 403);
    }

    // ── 3. Rate limit per signed-in user (fails open if the log table is missing,
    //       so notifications are never interrupted by a missed migration) ─────
    if (callerId) {
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: recent, error: logErr } = await admin
        .from('notification_send_log').select('recipient_count').eq('user_id', callerId).gte('created_at', since);
      if (logErr) {
        console.warn('[notify-hirer] rate-limit log unavailable, sending without limit check');
      } else {
        const used = (recent ?? []).reduce((n: number, r: any) => n + (r.recipient_count ?? 0), 0);
        if (used + recipients.length > MAX_EMAILS_PER_HOUR) {
          console.warn('[notify-hirer] rate limit reached');
          return json({ error: 'Too many emails sent in the last hour. Please try again later.' }, 429);
        }
      }
    }

    // ── 4. Send as plain text ───────────────────────────────────────────────
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: recipients,
        subject: subject.replace(/[\r\n]+/g, ' '),
        text: body,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('[notify-hirer] Resend error status', res.status);
      return json({ error: data }, res.status);
    }

    // Counts only — no addresses or content are stored.
    await admin.from('notification_send_log').insert({
      user_id: callerId,
      caller: trustedServer ? 'server' : (isTrustee ? 'trustee' : 'member'),
      recipient_count: recipients.length,
    }).then(({ error }: { error: unknown }) => { if (error) console.warn('[notify-hirer] could not write send log'); });

    return json({ success: true, id: data.id });
  } catch (err) {
    console.error('[notify-hirer] Error:', (err as Error).message);
    return json({ error: (err as Error).message }, 500);
  }
});
