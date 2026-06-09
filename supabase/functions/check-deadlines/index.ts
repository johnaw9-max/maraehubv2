/**
 * check-deadlines — scheduled daily at 08:00 UTC via pg_cron.
 *
 * Sends email notifications for:
 *   • Grant deadlines exactly 7 days away
 *   • Service reminders due exactly 7 days away
 *
 * Environment variables required:
 *   SUPABASE_URL             set automatically by Supabase
 *   SUPABASE_SERVICE_ROLE_KEY set automatically by Supabase
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const NOTIFY_URL        = `${SUPABASE_URL}/functions/v1/send-notification`;

function targetDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().split('T')[0];
}

function fmtDate(d: string): string {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-NZ', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

function footer(): string {
  return '\n\nNō reira, tēnā koutou, tēnā koutou, tēnā koutou katoa.\n\n—\nMaraeHub Notifications\nmaraehub.com';
}

async function notify(to: string[], subject: string, body: string) {
  if (to.length === 0) return;
  await fetch(NOTIFY_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ to, subject, body }),
  });
}

serve(async () => {
  const db      = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const dueDate = targetDate();

  // ── Trustee emails ────────────────────────────────────────────────────────
  const { data: trustees } = await db
    .from('profiles')
    .select('email')
    .eq('role', 'trustee')
    .not('email', 'is', null);

  const trusteeEmails = (trustees ?? []).map((t: { email: string }) => t.email).filter(Boolean);

  // ── Grant deadlines ───────────────────────────────────────────────────────
  const { data: grants } = await db
    .from('grants')
    .select('name, deadline, funder, amount, status')
    .eq('deadline', dueDate)
    .not('status', 'in', '("approved","declined")');

  for (const g of grants ?? []) {
    const body =
      `Tēnā koutou,\n\n` +
      `This is a reminder that the following grant deadline is in 7 days.\n\n` +
      `Grant: ${g.name}\n` +
      `Funder: ${g.funder ?? 'Not specified'}\n` +
      `Amount: ${g.amount ? '$' + Number(g.amount).toLocaleString('en-NZ') : 'Not specified'}\n` +
      `Deadline: ${fmtDate(g.deadline)}\n` +
      `Status: ${g.status}\n\n` +
      `Please log in to MaraeHub to review this grant application and ensure everything is on track.` +
      footer();

    await notify(trusteeEmails, `Grant deadline in 7 days — ${g.name}`, body);
  }

  // ── Service reminders ─────────────────────────────────────────────────────
  const { data: reminders } = await db
    .from('service_reminders')
    .select('type, due_date, notes, assets(name)')
    .eq('due_date', dueDate);

  for (const r of reminders ?? []) {
    const assetName = (r.assets as { name: string } | null)?.name ?? 'Unknown asset';
    const body =
      `Tēnā koutou,\n\n` +
      `This is a reminder that the following service is due in 7 days.\n\n` +
      `Service: ${r.type}\n` +
      `Asset: ${assetName}\n` +
      `Due: ${fmtDate(r.due_date)}\n` +
      (r.notes ? `Notes: ${r.notes}\n` : '') +
      `\nPlease log in to MaraeHub to update this service reminder once completed.` +
      footer();

    await notify(trusteeEmails, `Service reminder due in 7 days — ${r.type} (${assetName})`, body);
  }

  return new Response(
    JSON.stringify({
      checked: dueDate,
      grants: grants?.length ?? 0,
      reminders: reminders?.length ?? 0,
      trustees: trusteeEmails.length,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
});
