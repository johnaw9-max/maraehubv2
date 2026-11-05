// send-notification — SERVER-TO-SERVER ONLY (Phase 1, item 1, P1-01).
//
// Before Phase 1 this function had verify_jwt = false and checked nothing,
// so anyone who knew the URL could send any email to anyone from the
// MaraeHub address. It is now restricted to callers holding one of THIS
// project's secret keys:
//   • check-deadlines  sends its CHECK_DEADLINES_SECRET_KEY (sb_secret_ format)
//   • stripe-webhook   sends SUPABASE_SERVICE_ROLE_KEY
// No new secrets need to be set. verify_jwt stays false in config.toml
// because sb_secret_ keys are not JWTs; the check is done here instead.
//
// The browser app never calls this function (it uses notify-hirer).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { isProjectSecretKey, extractKeys } from './auth.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM_ADDRESS   = Deno.env.get('FROM_EMAIL') ?? 'MaraeHub <notifications@maraehub.co.nz>';

const MAX_RECIPIENTS = 50;
const MAX_SUBJECT    = 200;
const MAX_BODY       = 20000;

const cors = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // ── Caller must hold a secret key for this project ─────────────────────────
  if (!(await isProjectSecretKey(extractKeys(req)))) {
    console.warn('send-notification: refused unauthenticated call');
    return json({ error: 'Unauthorized' }, 401);
  }

  try {
    const { to, subject, body } = await req.json();

    if (!to || !subject || !body) return json({ error: 'to, subject, and body are required' }, 400);
    if (typeof subject !== 'string' || typeof body !== 'string') return json({ error: 'subject and body must be text' }, 400);
    if (subject.length > MAX_SUBJECT || body.length > MAX_BODY) return json({ error: 'subject or body too long' }, 400);

    if (!RESEND_API_KEY) return json({ error: 'RESEND_API_KEY is not set' }, 500);

    const recipients = (Array.isArray(to) ? to : [to]).filter((r) => typeof r === 'string' && r.includes('@'));
    if (recipients.length === 0) return json({ skipped: true, reason: 'no recipients' });
    if (recipients.length > MAX_RECIPIENTS) return json({ error: 'too many recipients' }, 400);

    // Count only — never log addresses or content.
    console.log(`send-notification: sending to ${recipients.length} recipient(s)`);

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: recipients,
        subject: subject.replace(/[\r\n]+/g, ' '),
        text: body,
      }),
    });

    const data = await res.json();
    if (!res.ok) return json({ error: data }, res.status);
    return json({ success: true, id: data.id });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
