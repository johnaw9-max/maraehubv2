import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Keep in step with src/lib/bookingOccasions.js. 'Whanau Reunion' stays accepted so a
// booking form left open in a browser tab from before the change still submits.
const OCCASIONS = [
  'Tangi', 'Wedding/Hakari', 'Birthday', 'Hui', 'Fundraiser',
  'Hura Kōhatu', 'Whānau Gathering', 'Noho Marae/Noho Wānanga', 'Other',
  'Whanau Reunion',
];

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Input hygiene (hardened 13 Nov 2026) ─────────────────────────────────────
// This form is public, so everything in it is typed by a stranger. Single-line
// fields lose line breaks and control characters, so nobody can fake extra lines
// in the trustee email. Free text (notes) is shown in its own labelled block.
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const oneLine = (v: unknown, max: number) =>
  (typeof v === 'string' ? v : '').replace(CONTROL, '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);
const EMAIL_RE = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]+$/;
const PHONE_RE = /^[0-9+()\-\s.]{3,30}$/;
const DATE_RE  = /^\d{4}-\d{2}-\d{2}$/;
const validDate = (d: unknown) => typeof d === 'string' && DATE_RE.test(d) && !Number.isNaN(new Date(d + 'T12:00:00').getTime());
const MAX_STAY_DAYS = 60;
// Slow-down limits so the form can't be used to flood the trustees' inboxes.
const MAX_PUBLIC_PER_HOUR      = 10;
const MAX_PER_EMAIL_PER_DAY    = 3;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const json = (body: object, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  try {
    const supabaseUrl    = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return json({ error: 'Invalid request' }, 400);
    const { occasion, startDate, endDate, guests, overnight, facilities } = body;

    // Server-side validation — never trust the anon client
    if (!OCCASIONS.includes(occasion)) return json({ error: 'Invalid occasion' }, 400);
    if (!validDate(startDate) || !validDate(endDate)) return json({ error: 'Start and end date are required' }, 400);
    if (endDate < startDate) return json({ error: 'The end date must be on or after the start date' }, 400);
    if ((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000 > MAX_STAY_DAYS) return json({ error: 'Please contact the marae directly for stays this long' }, 400);

    const contactName = oneLine(body.contactName, 120);
    if (!contactName) return json({ error: 'Contact name is required' }, 400);
    if (typeof body.contactName === 'string' && body.contactName.trim().length > 120) return json({ error: 'Contact name must be 120 characters or fewer' }, 400);

    const g = parseInt(guests);
    if (!Number.isFinite(g) || g < 0) return json({ error: 'Invalid guest count' }, 400);
    if (g > 5000) return json({ error: 'Invalid guest count' }, 400);

    const rawNotes = typeof body.notes === 'string' ? body.notes.replace(CONTROL, '').trim() : '';
    if (rawNotes.length > 500) return json({ error: 'Notes must be 500 characters or fewer' }, 400);
    const notes = rawNotes.replace(/\n{3,}/g, '\n\n');

    if (body.organisation && (typeof body.organisation !== 'string' || body.organisation.length > 120)) return json({ error: 'Organisation must be 120 characters or fewer' }, 400);
    const organisation = oneLine(body.organisation, 120);

    const contactPhone = oneLine(body.contactPhone, 30);
    if (contactPhone && !PHONE_RE.test(contactPhone)) return json({ error: 'Please check the phone number' }, 400);
    const contactEmail = oneLine(body.contactEmail, 254).toLowerCase();
    if (contactEmail && !EMAIL_RE.test(contactEmail)) return json({ error: 'Please check the email address' }, 400);

    const facilityList: string[] = Array.isArray(facilities)
      ? facilities.filter((f: unknown) => typeof f === 'string').slice(0, 20).map((f: string) => oneLine(f, 60)).filter(Boolean)
      : [];

    // Slow-down limits (counted from bookings already saved; no extra table needed)
    const hourAgo = new Date(Date.now() - 3600_000).toISOString();
    const dayAgo  = new Date(Date.now() - 86_400_000).toISOString();
    const { count: recentPublic } = await admin.from('bookings')
      .select('id', { count: 'exact', head: true }).is('user_id', null).gte('created_at', hourAgo);
    if ((recentPublic ?? 0) >= MAX_PUBLIC_PER_HOUR) return json({ error: 'We are receiving a lot of requests right now. Please try again in an hour, or contact the marae directly.' }, 429);
    if (contactEmail) {
      const { count: sameEmail } = await admin.from('bookings')
        .select('id', { count: 'exact', head: true }).is('user_id', null).eq('contact_email', contactEmail).gte('created_at', dayAgo);
      if ((sameEmail ?? 0) >= MAX_PER_EMAIL_PER_DAY) return json({ error: 'You have already sent several requests today. Please wait for the committee to reply, or contact the marae directly.' }, 429);
    }

    // Conflict check — same overlap logic as BookingWizard.checkAvailability()
    const { data: existing } = await admin.from('bookings').select('start_date, end_date').eq('status', 'approved');
    const { data: blocked }  = await admin.from('blocked_dates').select('from_date, to_date');
    const conflict = (existing || []).some((b: any) => startDate <= (b.end_date || b.start_date) && endDate >= b.start_date)
                   || (blocked  || []).some((b: any) => startDate <= b.to_date && endDate >= b.from_date);
    if (conflict) return json({ error: 'Those dates are no longer available' }, 409);

    const reference = 'MH-' + new Date().getFullYear() + '-' + Math.floor(Math.random() * 9000 + 1000);

    const { error: insertError } = await admin.from('bookings').insert({
      user_id: null,
      occasion,
      start_date: startDate,
      end_date: endDate,
      guests: g,
      overnight: !!overnight,
      facilities: facilityList,
      notes: notes || null,
      contact_name: contactName,
      contact_phone: contactPhone || null,
      contact_email: contactEmail || null,
      // Only included when given, so this works on a marae whose database has not
      // had the organisation column added yet.
      ...(organisation ? { organisation } : {}),
      status: 'pending', // forced server-side, never from the client
      reference,
    });
    if (insertError) {
      console.error('[public-booking-request] insert failed:', insertError.message);
      return json({ error: 'Your request could not be saved. Please try again.' }, 400);
    }

    // Notify trustees — server-side, bypasses RLS via service role
    const { data: trustees } = await admin.from('profiles').select('email').eq('role', 'trustee').not('email', 'is', null);
    const emails = (trustees || []).map((t: any) => t.email).filter(Boolean);
    if (emails.length) {
      // Sent as plain text through notify-hirer using this project's own key.
      // A failed email never loses the booking, but we log it so it is not silent.
      const { error: mailError } = await admin.functions.invoke('notify-hirer', {
        body: {
          to: emails,
          subject: `New booking request — ${occasion} (${reference})`,
          body:
            `Tēnā koutou,\n\n` +
            `A new booking request was submitted via the public form and is awaiting your review.\n\n` +
            `Occasion: ${occasion}\n` +
            (organisation ? `Organisation: ${organisation}\n` : '') +
            `Contact: ${contactName}${contactPhone ? ' / ' + contactPhone : ''}\n` +
            `Dates: ${fmtDate(startDate)} → ${fmtDate(endDate)}\n` +
            `Guests: ${g}\n` +
            `Overnight: ${overnight ? 'Yes' : 'No'}\n` +
            `Reference: ${reference}\n` +
            `\nPlease log in to MaraeHub to approve or decline this request.` +
            (notes ? `\n\n--- Notes typed by the requester (not checked by MaraeHub) ---\n${notes}\n--- end of notes ---` : ''),
        },
      });
      if (mailError) console.error('[public-booking-request] trustee email failed:', mailError.message);
    }

    return json({ success: true, reference });
  } catch (err) {
    console.error('[public-booking-request] error:', err);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
});
