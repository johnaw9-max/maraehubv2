// notify-hirer — sends a plain-text email from MaraeHub via Resend.
//
// Who may call it (hardened 13 Nov 2026 after the first independent code review):
//   1. This project's own server code (e.g. public-booking-request), proven by a
//      project secret key (see auth.ts). May email any valid address.
//   2. A logged-in trustee. May email any valid address (hirers, action owners…).
//   3. Any other logged-in person (e.g. a hirer submitting a booking). May ONLY
//      email trustees of this marae — never an arbitrary address.
// The public anon key is never enough. Email is sent as plain text, so nothing a
// person types can become a link, button or markup in the email. Addresses are
// not written to the logs and Resend's raw error is not passed back to callers.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { isProjectSecretKey, extractKeys } from './auth.ts'

const RESEND_API_KEY   = Deno.env.get('RESEND_API_KEY') ?? ''
const FROM_EMAIL       = Deno.env.get('FROM_EMAIL') ?? 'MaraeHub <onboarding@resend.dev>'
const SUPABASE_URL     = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON    = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const MAX_RECIPIENTS = 20
const MAX_SUBJECT    = 150
const MAX_BODY       = 5000
const EMAIL_RE       = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]+$/

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const reply = (body: object, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    // ── Who is calling? ──────────────────────────────────────────────────────
    const serverCaller = await isProjectSecretKey(extractKeys(req))
    let isTrustee = false

    if (!serverCaller) {
      const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
      if (!token) return reply({ error: 'Missing Authorization header' }, 401)

      const userClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      })
      const { data: { user }, error: authError } = await userClient.auth.getUser()
      if (authError || !user) {
        console.warn('[notify-hirer] rejected unauthenticated request')
        return reply({ error: 'Unauthorized' }, 401)
      }
      const { data: profile } = await userClient.from('profiles').select('role').eq('id', user.id).maybeSingle()
      isTrustee = profile?.role === 'trustee'
    }

    // ── Check the message ────────────────────────────────────────────────────
    const payload = await req.json().catch(() => null)
    const rawTo = payload?.to
    const list: unknown[] = Array.isArray(rawTo) ? rawTo : rawTo ? [rawTo] : []
    const recipients = [...new Set(
      list.map((e) => (typeof e === 'string' ? e.trim().toLowerCase() : '')).filter(Boolean),
    )]
    const subject = typeof payload?.subject === 'string' ? payload.subject.replace(/[\r\n]+/g, ' ').trim() : ''
    const body    = typeof payload?.body === 'string' ? payload.body : ''

    if (!recipients.length || !subject || !body) {
      return reply({ error: 'Missing required fields: to, subject, body' }, 400)
    }
    if (recipients.length > MAX_RECIPIENTS) return reply({ error: 'Too many recipients' }, 400)
    if (recipients.some((e) => e.length > 254 || !EMAIL_RE.test(e))) return reply({ error: 'Invalid email address' }, 400)
    if (subject.length > MAX_SUBJECT) return reply({ error: 'Subject is too long' }, 400)
    if (body.length > MAX_BODY) return reply({ error: 'Message is too long' }, 400)

    // ── A non-trustee may only write to trustees ─────────────────────────────
    if (!serverCaller && !isTrustee) {
      const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
      const { data: trustees } = await admin.from('profiles').select('email').eq('role', 'trustee').not('email', 'is', null)
      const allowed = new Set((trustees ?? []).map((t: { email: string }) => (t.email ?? '').trim().toLowerCase()))
      if (!recipients.every((e) => allowed.has(e))) {
        console.warn('[notify-hirer] non-trustee tried to email a non-trustee address')
        return reply({ error: 'Not allowed' }, 403)
      }
    }

    if (!RESEND_API_KEY) {
      console.warn('[notify-hirer] RESEND_API_KEY not set')
      return reply({ error: 'Email service not configured' }, 500)
    }

    console.log(`[notify-hirer] caller=${serverCaller ? 'server' : isTrustee ? 'trustee' : 'member'} recipients=${recipients.length}`)

    // Plain text only: nothing typed by a person can turn into markup or a link.
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_EMAIL, to: recipients, subject, text: body }),
    })
    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      console.error('[notify-hirer] Resend error status:', res.status, data?.name ?? '')
      return reply({ error: 'Email could not be sent' }, 502)
    }
    return reply({ success: true, id: data.id })
  } catch (err) {
    console.error('[notify-hirer] Error:', err)
    return reply({ error: 'Something went wrong sending the email' }, 500)
  }
})
