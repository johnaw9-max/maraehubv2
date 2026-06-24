/**
 * check-deadlines — scheduled daily at 08:00 UTC via pg_cron.
 *
 * 1. Sends email notifications for:
 *      • Grant deadlines exactly 7 days away
 *      • Service reminders due exactly 7 days away
 *
 * 2. Auto-starts workflows for service reminders that:
 *      • Are due within 14 days OR already overdue (up to 30 days back)
 *      • Have auto_workflow_enabled = true
 *      • Do not already have an active workflow_instance linked via entity_type/entity_id
 *    Creates: workflow_instance → parent task → subtasks from template steps.
 *
 * Environment variables required:
 *   SUPABASE_URL             set automatically by Supabase
 *   SUPABASE_SERVICE_ROLE_KEY set automatically by Supabase
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const NOTIFY_URL       = `${SUPABASE_URL}/functions/v1/send-notification`;

// ── Date helpers ─────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function offsetDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
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

// ── Email helper ─────────────────────────────────────────────────────────────

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

// ── Workflow template matching ────────────────────────────────────────────────
// Mirrors src/lib/workflowEngine.js — keyword map → fuzzy word match → asset
// category fallback → first available template.

const KEYWORD_TEMPLATE_MAP = [
  { keywords: ['lawnmower', 'mower'],      template: 'Building Maintenance and Repair' },
  { keywords: ['heat pump', 'heatpump'],   template: 'Heat Pump Service' },
  { keywords: ['fire'],                     template: 'Fire Safety Compliance Check' },
  { keywords: ['insurance'],                template: 'Marae Insurance Renewal' },
  { keywords: ['wof', 'vehicle'],           template: 'Building Maintenance and Repair' },
  { keywords: ['facility hire'],            template: 'Facility Hire Agreement' },
];

const CATEGORY_TEMPLATE_MAP: Record<string, string> = {
  Building:   'Building Maintenance and Repair',
  Equipment:  'Building Maintenance and Repair',
  Vehicle:    'Building Maintenance and Repair',
  Technology: 'Building Maintenance and Repair',
  Grounds:    'Building Maintenance and Repair',
};

interface Template { id: string; name: string }

function matchTemplate(
  serviceType: string,
  assetCategory: string,
  templates: Template[],
): Template | null {
  if (!templates.length) return null;
  const type = serviceType.toLowerCase();

  // 1. Explicit keyword map (highest priority)
  for (const { keywords, template } of KEYWORD_TEMPLATE_MAP) {
    if (keywords.some(k => type.includes(k))) {
      const hit = templates.find(t => t.name === template);
      if (hit) return hit;
    }
  }

  // 2. Fuzzy word overlap (5+ char non-stopword shared with template name)
  const STOPWORDS = new Set(['service', 'check', 'marae', 'repair', 'renewal', 'compliance', 'safety']);
  const words = type.split(/[\s\-&,/]+/).filter(w => w.length >= 5 && !STOPWORDS.has(w));
  if (words.length) {
    for (const tpl of templates) {
      const tplLow = tpl.name.toLowerCase();
      if (words.some(w => tplLow.includes(w))) return tpl;
    }
  }

  // 3. Asset category fallback
  const fallback = CATEGORY_TEMPLATE_MAP[assetCategory];
  if (fallback) {
    const hit = templates.find(t => t.name === fallback);
    if (hit) return hit;
  }

  // 4. Last resort — use first available template
  return templates[0];
}

// ── Main handler ─────────────────────────────────────────────────────────────

serve(async () => {
  const db      = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const today   = todayStr();
  const dueDate = offsetDate(7);  // exact 7-day target for email notifications

  // ── Trustee emails ──────────────────────────────────────────────────────────
  const { data: trustees } = await db
    .from('profiles')
    .select('email')
    .eq('role', 'trustee')
    .not('email', 'is', null);

  const trusteeEmails = (trustees ?? []).map((t: { email: string }) => t.email).filter(Boolean);

  // ── Grant deadline emails ───────────────────────────────────────────────────
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

  // ── Service reminder emails (7-day exact) ───────────────────────────────────
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

  // ── Auto-trigger workflows ──────────────────────────────────────────────────
  // Window: overdue up to 30 days back through 14 days ahead.
  // The "already has active workflow" check prevents duplicate creation on
  // subsequent daily runs.

  const workflowLog: string[] = [];
  const skippedLog:  string[] = [];

  // Load all active templates with their steps in one query
  const { data: templateRows } = await db
    .from('workflow_templates')
    .select('id, name, category, workflow_steps(id, title, description, step_order)')
    .eq('is_active', true);

  const templates: Template[] = (templateRows ?? []).map(t => ({ id: t.id, name: t.name }));

  // Service reminders in the auto-trigger window with opt-in enabled
  const { data: autoReminders, error: autoErr } = await db
    .from('service_reminders')
    .select('id, type, due_date, notes, assets(id, name, category)')
    .eq('auto_workflow_enabled', true)
    .not('due_date', 'is', null)
    .gte('due_date', offsetDate(-30))   // no older than 30 days overdue
    .lte('due_date', offsetDate(14));   // up to 14 days ahead

  if (autoErr) {
    skippedLog.push(`ERROR — could not query service_reminders: ${autoErr.message}`);
  }

  for (const reminder of autoReminders ?? []) {
    const asset       = reminder.assets as { id: string; name: string; category: string } | null;
    const assetName   = asset?.name     ?? 'Unknown Asset';
    const assetCat    = asset?.category ?? 'Other';

    // Skip if an active workflow_instance is already linked to this reminder
    const { data: existing } = await db
      .from('workflow_instances')
      .select('id')
      .eq('entity_type', 'service_reminder')
      .eq('entity_id', reminder.id)
      .eq('status', 'active')
      .maybeSingle();

    if (existing) {
      skippedLog.push(
        `SKIP (active workflow exists ${existing.id}) — "${reminder.type}" on ${assetName}`,
      );
      continue;
    }

    // Match best-fit workflow template
    const matched = matchTemplate(reminder.type, assetCat, templates);
    if (!matched) {
      skippedLog.push(`SKIP (no template matched) — "${reminder.type}" on ${assetName}`);
      continue;
    }

    const templateRow  = (templateRows ?? []).find(t => t.id === matched.id);
    const steps        = (templateRow?.workflow_steps ?? [])
      .slice()
      .sort((a: { step_order: number }, b: { step_order: number }) => a.step_order - b.step_order);

    const instanceName = `${matched.name} — ${assetName} (auto)`;

    // 1. Create workflow instance
    const { data: instance, error: instErr } = await db
      .from('workflow_instances')
      .insert({
        template_id:  matched.id,
        name:         instanceName,
        due_date:     reminder.due_date,
        status:       'active',
        progress_pct: 0,
        entity_type:  'service_reminder',
        entity_id:    reminder.id,
        entity_name:  `${reminder.type} — ${assetName}`,
        trigger_type: 'auto',
        trigger_date: today,
      })
      .select()
      .single();

    if (instErr || !instance) {
      skippedLog.push(
        `ERROR (workflow_instance insert failed) — "${reminder.type}": ${instErr?.message}`,
      );
      continue;
    }

    // 2. Create parent task
    const { data: parentTask, error: parentErr } = await db
      .from('tasks')
      .insert({
        title:                instanceName,
        status:               'open',
        due_date:             reminder.due_date,
        workflow_instance_id: instance.id,
      })
      .select()
      .single();

    if (parentErr || !parentTask) {
      skippedLog.push(
        `ERROR (parent task insert failed) — instance ${instance.id}: ${parentErr?.message}`,
      );
      continue;
    }

    // 3. Create subtasks from template steps
    if (steps.length > 0) {
      const subtasks = steps.map((s: { title: string; description: string | null; step_order: number }) => ({
        title:                s.title,
        description:          s.description ?? null,
        status:               'open',
        due_date:             reminder.due_date,
        workflow_instance_id: instance.id,
        workflow_step_order:  s.step_order,
        parent_task_id:       parentTask.id,
      }));

      const { error: subErr } = await db.from('tasks').insert(subtasks);
      if (subErr) {
        skippedLog.push(`WARN (subtasks failed) — instance ${instance.id}: ${subErr.message}`);
      }
    }

    workflowLog.push(
      `CREATED — "${instanceName}" | template: ${matched.name} | ${steps.length} steps` +
      ` | reminder: "${reminder.type}" on ${assetName} | due: ${reminder.due_date}`,
    );
  }

  return new Response(
    JSON.stringify({
      checked:           dueDate,
      today,
      grants:            grants?.length ?? 0,
      reminders:         reminders?.length ?? 0,
      trustees:          trusteeEmails.length,
      workflows_created: workflowLog.length,
      workflows_log:     workflowLog,
      workflows_skipped: skippedLog,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
});
