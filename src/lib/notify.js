import { supabase } from './supabase';

/**
 * Fire-and-forget email notification via the send-notification Edge Function.
 * Never throws — failures are logged but don't block the UI.
 *
 * @param {string|string[]} to      Recipient email(s)
 * @param {string}          subject Email subject
 * @param {string}          body    Plain-text body
 */
export async function sendNotification(to, subject, body) {
  try {
    const { error } = await supabase.functions.invoke('send-notification', {
      body: { to, subject, body },
    });
    if (error) console.error('[notify]', error.message);
  } catch (err) {
    console.error('[notify]', err);
  }
}

/** Returns email addresses for all trustees who have one. */
export async function getTrusteeEmails() {
  const { data } = await supabase
    .from('profiles')
    .select('email')
    .eq('role', 'trustee')
    .not('email', 'is', null);
  return (data ?? []).map(t => t.email).filter(Boolean);
}

/** Looks up a person's email by their full name (profiles first, then contacts). */
export async function getEmailByName(fullName) {
  if (!fullName) return null;
  const name = fullName.trim();
  const [pRes, cRes] = await Promise.all([
    supabase.from('profiles').select('email').eq('full_name', name).maybeSingle(),
    supabase.from('contacts').select('email').eq('full_name', name).maybeSingle(),
  ]);
  return pRes.data?.email || cRes.data?.email || null;
}

const FOOTER =
  '\n\nNō reira, tēnā koutou, tēnā koutou, tēnā koutou katoa.\n\n—\nMaraeHub Notifications\nmaraehub.com';

function fmtDate(d) {
  if (!d) return 'date TBC';
  return new Date(d + 'T12:00:00').toLocaleDateString('en-NZ', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

// ── Pre-built notification bodies ──────────────────────────────────────────────

export function bookingSubmittedBody(booking) {
  return (
    `Tēnā koutou,\n\n` +
    `A new booking request has been submitted on MaraeHub and is awaiting your review.\n\n` +
    `Occasion: ${booking.occasion}\n` +
    `Dates: ${fmtDate(booking.start_date)} → ${fmtDate(booking.end_date)}\n` +
    `Guests: ${booking.guests}\n` +
    `Overnight: ${booking.overnight ? 'Yes' : 'No'}\n` +
    `Reference: ${booking.reference}\n` +
    (booking.notes ? `Notes: ${booking.notes}\n` : '') +
    `\nPlease log in to MaraeHub to approve or decline this request.` +
    FOOTER
  );
}

export function bookingStatusBody(booking, status) {
  const approved = status === 'approved';
  return (
    `Tēnā koe,\n\n` +
    (approved
      ? `Ka pai! Your booking request has been approved.\n\n`
      : `We regret to let you know that your booking request could not be approved at this time.\n\n`) +
    `Occasion: ${booking.occasion}\n` +
    `Dates: ${fmtDate(booking.start_date)} → ${fmtDate(booking.end_date)}\n` +
    `Guests: ${booking.guests}\n` +
    `Reference: ${booking.reference}\n` +
    `\nPlease log in to MaraeHub to view the full details of your booking.` +
    FOOTER
  );
}

export function meetingActionBody(action, meeting) {
  return (
    `Tēnā koe ${action.assigned_to},\n\n` +
    `You have been assigned an action from a recent meeting.\n\n` +
    `Meeting: ${meeting.title}\n` +
    `Type: ${meeting.meeting_type}\n` +
    `Action: ${action.description}\n` +
    `Due: ${fmtDate(action.due_date)}\n` +
    `\nPlease log in to MaraeHub to view and manage your actions.` +
    FOOTER
  );
}
