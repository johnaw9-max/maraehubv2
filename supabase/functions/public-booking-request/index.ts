import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OCCASIONS = ['Tangi', 'Wedding/Hakari', 'Birthday', 'Hui', 'Fundraiser', 'Whanau Reunion', 'Other'];

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const json = (body: object, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  try {
    const supabaseUrl    = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { occasion, startDate, endDate, guests, overnight, facilities, notes, contactName, contactPhone, contactEmail } = body;

    // Server-side validation — never trust the anon client
    if (!OCCASIONS.includes(occasion)) return json({ error: 'Invalid occasion' }, 400);
    if (!startDate || !endDate) return json({ error: 'Start and end date are required' }, 400);
    if (!contactName || !contactName.trim()) return json({ error: 'Contact name is required' }, 400);
    const g = parseInt(guests);
    if (!Number.isFinite(g) || g < 0) return json({ error: 'Invalid guest count' }, 400);
    if (notes && notes.length > 500) return json({ error: 'Notes must be 500 characters or fewer' }, 400);

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
      facilities: facilities || [],
      notes: notes || null,
      contact_name: contactName.trim(),
      contact_phone: contactPhone?.trim() || null,
      contact_email: contactEmail?.trim() || null,
      status: 'pending', // forced server-side, never from the client
      reference,
    });
    if (insertError) return json({ error: insertError.message }, 400);

    // Notify trustees — server-side, bypasses RLS via service role
    const { data: trustees } = await admin.from('profiles').select('email').eq('role', 'trustee').not('email', 'is', null);
    const emails = (trustees || []).map((t: any) => t.email).filter(Boolean);
    if (emails.length) {
      await admin.functions.invoke('notify-hirer', {
        body: {
          to: emails,
          subject: `New booking request — ${occasion} (${reference})`,
          body:
            `Tēnā koutou,\n\n` +
            `A new booking request was submitted via the public form and is awaiting your review.\n\n` +
            `Occasion: ${occasion}\n` +
            `Contact: ${contactName}${contactPhone ? ' / ' + contactPhone : ''}\n` +
            `Dates: ${fmtDate(startDate)} → ${fmtDate(endDate)}\n` +
            `Guests: ${g}\n` +
            `Overnight: ${overnight ? 'Yes' : 'No'}\n` +
            `Reference: ${reference}\n` +
            (notes ? `Notes: ${notes}\n` : '') +
            `\nPlease log in to MaraeHub to approve or decline this request.`,
        },
      });
    }

    return json({ success: true, reference });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
