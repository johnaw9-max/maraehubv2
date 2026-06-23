/**
 * notify-trustees — comprehensive daily notification digest for MaraeHub.
 *
 * Handles five notification types, each controlled by trustee preferences:
 *   • bookings   — approved bookings starting in 48 hours
 *   • compliance — compliance items due within 30 days
 *   • grants     — grant deadlines within 14 days
 *   • actions    — meeting actions overdue by 7+ days
 *   • goals      — goals newly marked at_risk or completed
 *
 * Uses notification_log table to prevent duplicate sends.
 * Sends HTML emails via Resend.
 *
 * Environment variables:
 *   SUPABASE_URL              — set automatically by Supabase
 *   SUPABASE_SERVICE_ROLE_KEY — set automatically by Supabase
 *   RESEND_API_KEY            — set in Supabase Dashboard → Edge Functions → Secrets
 *   FROM_EMAIL                — optional, defaults to MaraeHub <notifications@maraehub.com>
 *   APP_URL                   — optional, defaults to https://maraehubv2.vercel.app
 */

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY      = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY   = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM_ADDRESS     = Deno.env.get('FROM_EMAIL') ?? 'MaraeHub <onboarding@resend.dev>';
const APP_URL          = Deno.env.get('APP_URL') ?? 'https://maraehubv2.vercel.app';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Date helpers ─────────────────────────────────────────────────────────────

function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}
function toDateStr(d: Date): string { return d.toISOString().split('T')[0]; }
function fmtDate(s: string): string {
  return new Date(s + 'T12:00:00').toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' });
}
function fmtMoney(n: number | null): string {
  if (!n) return '';
  if (n >= 1_000_000) return ` · $${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return ` · $${Math.round(n / 1_000)}k`;
  return ` · $${n}`;
}

// ─── HTML email ───────────────────────────────────────────────────────────────

function emailHtml(title: string, intro: string, rows: string[]): string {
  const items = rows.map(r =>
    `<tr><td style="padding:12px 32px;border-bottom:1px solid #f0ebe3;font-size:14px;color:#2a2a2a;line-height:1.6;">${r}</td></tr>`
  ).join('');

  return `<!DOCTYPE html><html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f0e8;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0e8;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08);">
  <tr><td style="background:#1a4a3a;padding:20px 32px;">
    <span style="font-size:22px;font-weight:700;color:#c8902a;font-family:Georgia,serif;">M</span>
    <span style="font-size:14px;font-weight:600;color:#fff;margin-left:8px;vertical-align:middle;">MaraeHub</span>
  </td></tr>
  <tr><td style="padding:24px 32px 16px;border-bottom:1px solid #f0ebe3;">
    <h1 style="margin:0 0 10px;font-size:20px;color:#1a4a3a;font-family:Georgia,serif;">${title}</h1>
    <p style="margin:0;font-size:14px;color:#6b6058;line-height:1.6;">${intro}</p>
  </td></tr>
  ${items}
  <tr><td style="padding:20px 32px;">
    <a href="${APP_URL}" style="display:inline-block;background:#1a4a3a;color:#fff;text-decoration:none;padding:11px 24px;border-radius:8px;font-size:14px;font-weight:600;">Open MaraeHub →</a>
  </td></tr>
  <tr><td style="padding:16px 32px;border-top:1px solid #f0ebe3;font-size:12px;color:#9a9088;line-height:1.6;">
    Nō reira, tēnā koutou, tēnā koutou, tēnā koutou katoa.<br>
    <a href="${APP_URL}" style="color:#1a4a3a;text-decoration:none;">MaraeHub</a> · maraehub.com
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!RESEND_API_KEY) { console.warn('[notify-trustees] RESEND_API_KEY not set — skipping', to); return; }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_ADDRESS, to: [to], subject, html }),
  });
  if (!res.ok) console.error('[notify-trustees] Resend error for', to, await res.text());
}

// ─── Deduplication ────────────────────────────────────────────────────────────

type LogEntry = { notification_type: string; entity_id: string; entity_key: string | null; trustee_id: string; sent_at: string };

function wasSent(log: LogEntry[], type: string, entityId: string, trusteeId: string, entityKey?: string, withinDays?: number): boolean {
  const cutoff = withinDays ? new Date(Date.now() - withinDays * 86400000).toISOString() : null;
  return log.some(l =>
    l.notification_type === type &&
    l.entity_id         === entityId &&
    l.trustee_id        === trusteeId &&
    (entityKey == null || l.entity_key === entityKey) &&
    (cutoff == null || l.sent_at >= cutoff)
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const db    = createClient(SUPABASE_URL, SERVICE_KEY);
  const today = new Date(); today.setHours(0, 0, 0, 0);

  // Pre-fetch everything needed for all notification types in parallel
  const [
    trusteesRes, logRes,
    bookingsRes, complianceRes, grantsRes, actionsRes, goalsRes,
  ] = await Promise.all([
    db.from('profiles').select('id, full_name, email, notification_prefs').eq('role', 'trustee').not('email', 'is', null),
    db.from('notification_log').select('notification_type, entity_id, entity_key, trustee_id, sent_at').gte('sent_at', new Date(Date.now() - 35 * 86400000).toISOString()),
    // Bookings starting in exactly 48h (date = today+2)
    db.from('bookings').select('id, occasion, start_date, guests').eq('status', 'approved').eq('start_date', toDateStr(addDays(today, 2))),
    // Compliance items due in next 30 days
    db.from('compliance_items').select('id, name, category, due_date').gte('due_date', toDateStr(today)).lte('due_date', toDateStr(addDays(today, 30))).order('due_date'),
    // Grants with deadline in next 14 days, not approved/declined
    db.from('grants').select('id, name, funder, amount, deadline, status').gte('deadline', toDateStr(today)).lte('deadline', toDateStr(addDays(today, 14))).not('status', 'in', '("approved","declined")').order('deadline'),
    // Meeting actions overdue by 7+ days
    db.from('meeting_actions').select('id, description, assigned_to, due_date, status').lt('due_date', toDateStr(addDays(today, -7))).neq('status', 'Completed').order('due_date'),
    // Goals at_risk or completed
    db.from('goals').select('id, name, status, target_date, responsible_name').in('status', ['at_risk', 'completed']),
  ]);

  const trustees  = trusteesRes.data  ?? [];
  const log       = (logRes.data ?? []) as LogEntry[];
  const bookings  = bookingsRes.data  ?? [];
  const compItems = complianceRes.data ?? [];
  const grants    = grantsRes.data    ?? [];
  const actions   = actionsRes.data   ?? [];
  const goals     = goalsRes.data     ?? [];

  const newLogEntries: Omit<LogEntry, 'sent_at'>[] = [];
  const result = { trustees: trustees.length, bookings: 0, compliance: 0, grants: 0, actions: 0, goals: 0, emails: 0 };

  for (const trustee of trustees) {
    const prefs: Record<string, boolean> = trustee.notification_prefs ?? {};
    const email  = trustee.email as string;
    const id     = trustee.id   as string;
    const name   = (trustee.full_name as string | null) ?? 'Trustee';

    // ── 1. Booking reminders (48h) ─────────────────────────────────────────────
    if (prefs.bookings !== false) {
      for (const b of bookings) {
        if (wasSent(log, 'booking_reminder', b.id, id)) continue;
        await sendEmail(
          email,
          `Booking reminder — ${b.occasion} on ${fmtDate(b.start_date)}`,
          emailHtml(
            'Booking Reminder — Tomorrow',
            `Tēnā koe ${name}, a confirmed booking is starting the day after tomorrow.`,
            [`<strong>${b.occasion}</strong><br>📅 ${fmtDate(b.start_date)}&nbsp; · &nbsp;👥 ${b.guests ?? '?'} guests`],
          ),
        );
        newLogEntries.push({ notification_type: 'booking_reminder', entity_id: b.id, entity_key: null, trustee_id: id });
        result.bookings++; result.emails++;
      }
    }

    // ── 2. Compliance items due within 30 days ─────────────────────────────────
    if (prefs.compliance !== false) {
      const fresh = compItems.filter(c => !wasSent(log, 'compliance_due', c.id, id, undefined, 25));
      if (fresh.length > 0) {
        const rows = fresh.map(c => {
          const days = Math.ceil((new Date(c.due_date + 'T12:00:00').getTime() - today.getTime()) / 86400000);
          const urgency = days === 0 ? '<span style="color:#d9534f;font-weight:700;">Due today</span>' : days <= 7 ? `<span style="color:#d9534f;font-weight:600;">${days} day${days !== 1 ? 's' : ''} remaining</span>` : `<span style="color:#c8902a;">${days} days remaining</span>`;
          return `<strong>${c.name}</strong><br>📅 ${fmtDate(c.due_date)}&nbsp; · &nbsp;${urgency}`;
        });
        await sendEmail(
          email,
          `${fresh.length} compliance item${fresh.length !== 1 ? 's' : ''} due soon`,
          emailHtml(
            `Compliance Items Due Soon`,
            `Tēnā koe ${name}, the following compliance obligation${fresh.length !== 1 ? 's are' : ' is'} due within 30 days. Please ensure renewals are arranged.`,
            rows,
          ),
        );
        for (const c of fresh) newLogEntries.push({ notification_type: 'compliance_due', entity_id: c.id, entity_key: null, trustee_id: id });
        result.compliance++; result.emails++;
      }
    }

    // ── 3. Grant deadlines within 14 days ─────────────────────────────────────
    if (prefs.grants !== false) {
      const fresh = grants.filter(g => !wasSent(log, 'grant_deadline', g.id, id, undefined, 10));
      if (fresh.length > 0) {
        const rows = fresh.map(g => {
          const days = Math.ceil((new Date(g.deadline + 'T12:00:00').getTime() - today.getTime()) / 86400000);
          const urgency = days <= 3 ? `<span style="color:#d9534f;font-weight:700;">${days === 0 ? 'Due today!' : `${days} day${days !== 1 ? 's' : ''} left`}</span>` : `<span style="color:#c8902a;font-weight:600;">${days} days left</span>`;
          return `<strong>${g.name}</strong><br>🏦 ${g.funder ?? 'Funder not set'}${fmtMoney(g.amount)}<br>📅 Deadline: ${fmtDate(g.deadline)}&nbsp; · &nbsp;${urgency}`;
        });
        await sendEmail(
          email,
          `${fresh.length} grant deadline${fresh.length !== 1 ? 's' : ''} in the next 14 days`,
          emailHtml(
            `Grant Deadline${fresh.length !== 1 ? 's' : ''} Approaching`,
            `Tēnā koe ${name}, the following grant deadline${fresh.length !== 1 ? 's are' : ' is'} within 14 days. Please ensure applications are complete and submitted.`,
            rows,
          ),
        );
        for (const g of fresh) newLogEntries.push({ notification_type: 'grant_deadline', entity_id: g.id, entity_key: null, trustee_id: id });
        result.grants++; result.emails++;
      }
    }

    // ── 4. Meeting actions overdue 7+ days ─────────────────────────────────────
    if (prefs.actions !== false) {
      const fresh = actions.filter(a => !wasSent(log, 'action_overdue', a.id, id, undefined, 7));
      if (fresh.length > 0) {
        const rows = fresh.map(a => {
          const days = Math.ceil((today.getTime() - new Date(a.due_date + 'T12:00:00').getTime()) / 86400000);
          return `<strong>${a.description}</strong><br>👤 ${a.assigned_to ?? 'Unassigned'}&nbsp; · &nbsp;<span style="color:#d9534f;font-weight:600;">Overdue by ${days} day${days !== 1 ? 's' : ''}</span>`;
        });
        await sendEmail(
          email,
          `${fresh.length} meeting action${fresh.length !== 1 ? 's' : ''} overdue`,
          emailHtml(
            `Overdue Meeting Actions`,
            `Tēnā koe ${name}, the following meeting action${fresh.length !== 1 ? 's are' : ' is'} more than 7 days overdue. Please follow up with those responsible.`,
            rows,
          ),
        );
        for (const a of fresh) newLogEntries.push({ notification_type: 'action_overdue', entity_id: a.id, entity_key: null, trustee_id: id });
        result.actions++; result.emails++;
      }
    }

    // ── 5. Goal status changes (at_risk / completed) ───────────────────────────
    if (prefs.goals !== false) {
      for (const g of goals) {
        // entity_key = status so we notify once per status value per goal
        if (wasSent(log, 'goal_status', g.id, id, g.status)) continue;
        const isComplete = g.status === 'completed';
        const statusLabel = isComplete ? 'Completed ✅' : 'At Risk ⚠️';
        const statusColor = isComplete ? '#1a4a3a' : '#c8902a';
        const rows = [
          `<strong>${g.name}</strong><br>` +
          `📊 Status: <strong style="color:${statusColor};">${statusLabel}</strong>` +
          (g.target_date   ? `<br>📅 Target date: ${fmtDate(g.target_date)}` : '') +
          (g.responsible_name ? `<br>👤 Responsible: ${g.responsible_name}` : ''),
        ];
        await sendEmail(
          email,
          `Goal ${isComplete ? 'completed' : 'at risk'} — ${g.name}`,
          emailHtml(
            `Strategic Goal ${isComplete ? 'Completed' : 'Marked At Risk'}`,
            `Tēnā koe ${name}, a strategic goal has been updated.`,
            rows,
          ),
        );
        newLogEntries.push({ notification_type: 'goal_status', entity_id: g.id, entity_key: g.status, trustee_id: id });
        result.goals++; result.emails++;
      }
    }
  }

  // Batch-insert all new log entries
  if (newLogEntries.length > 0) {
    await db.from('notification_log').insert(newLogEntries);
  }

  console.log('[notify-trustees] done:', result);

  return new Response(JSON.stringify({ success: true, ...result }), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});
