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
import { EXPECTED_SCHEMA } from './expectedSchema.ts';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ADMIN_ALERT_EMAIL = Deno.env.get('ADMIN_ALERT_EMAIL');
const NOTIFY_URL       = `${SUPABASE_URL}/functions/v1/send-notification`;
const adminEmails      = ADMIN_ALERT_EMAIL ? [ADMIN_ALERT_EMAIL] : [];

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

// Maintenance-shield checks (null_value_drift, orphaned_records,
// single_row_invariant, cron_health, orphaned_auth_users) are
// developer-facing, not trustee-facing — they alert ADMIN_ALERT_EMAIL
// only. If that secret is
// unset, notify()'s empty-array no-op would otherwise swallow the alert
// with no trace anywhere but system_check_log — log a warning instead so
// a missing secret is visible in function_logs.
async function notifyAdmin(subject: string, body: string) {
  if (adminEmails.length === 0) {
    console.warn(`ADMIN_ALERT_EMAIL not set — skipped admin alert: "${subject}"`);
    return;
  }
  await notify(adminEmails, subject, body);
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

  // ── Overdue meeting action reminders (7+ days overdue, catch-up range) ─────
  // Single-stage, direct-to-assignee — not the escalating 30/14/7 pattern
  // (that doesn't exist elsewhere in this codebase; this mirrors the
  // single-notification style the grants/reminders emails above already use).
  //
  // Catch-up range (due_date <= cutoff), not an exact match: an exact match
  // on due_date === today-7 would silently never catch anything already more
  // than 7 days overdue at the time this feature ships. Dedup is via
  // last_reminded_at (null, or older than the same 7-day window) rather than
  // a fresh column per run, so this can't resend daily forever for an item
  // that's still overdue and unresolved — at most once per 7-day window.
  const overdueCutoff  = offsetDate(-7);
  const reminderCutoff = new Date();
  reminderCutoff.setDate(reminderCutoff.getDate() - 7);
  const reminderCutoffISO = reminderCutoff.toISOString();

  const { data: overdueActions } = await db
    .from('meeting_actions')
    .select('id, description, assigned_to, due_date, last_reminded_at, meetings(title, meeting_type)')
    .lte('due_date', overdueCutoff)
    .not('status', 'eq', 'Completed')
    .or(`last_reminded_at.is.null,last_reminded_at.lt.${reminderCutoffISO}`);

  const actionReminderLog: string[] = [];
  const actionSkippedLog:  string[] = [];

  for (const action of overdueActions ?? []) {
    const meeting = action.meetings as { title: string; meeting_type: string } | null;

    if (!action.assigned_to) {
      actionSkippedLog.push(`SKIP (no assignee) — "${action.description}"`);
      await notify(
        trusteeEmails,
        `Action reminder could not be sent — check assignee`,
        `Tēnā koutou,\n\n` +
        `MaraeHub could not send an overdue-action reminder for the item below, ` +
        `because it has no assignee on file.\n\n` +
        `Action: ${action.description}\n` +
        `Assigned to: (none)\n` +
        `Due: ${fmtDate(action.due_date)}\n\n` +
        `Please assign this action to someone, or mark it complete if it's no longer relevant.` +
        footer(),
      );
      await db.from('meeting_actions').update({ last_reminded_at: new Date().toISOString() }).eq('id', action.id);
      continue;
    }

    const name = action.assigned_to.trim();
    const [profileRes, contactRes] = await Promise.all([
      db.from('profiles').select('id, email, role').eq('full_name', name).maybeSingle(),
      db.from('contacts').select('email').eq('full_name', name).maybeSingle(),
    ]);
    const email = profileRes.data?.email || contactRes.data?.email || null;
    const isTrustee = profileRes.data?.role === 'trustee';

    if (!email) {
      actionSkippedLog.push(`SKIP (no email found for "${name}") — "${action.description}"`);
      await notify(
        trusteeEmails,
        `Action reminder could not be sent — check assignee`,
        `Tēnā koutou,\n\n` +
        `MaraeHub could not send an overdue-action reminder for the item below, ` +
        `because no email address could be found for the assignee on file.\n\n` +
        `Action: ${action.description}\n` +
        `Assigned to: "${name}"\n` +
        `Due: ${fmtDate(action.due_date)}\n\n` +
        `Please check that this name matches a trustee or contact's full name exactly, ` +
        `or reassign the action to someone with an email on file.` +
        footer(),
      );
      await db.from('meeting_actions').update({ last_reminded_at: new Date().toISOString() }).eq('id', action.id);
      continue;
    }

    const daysOverdue = Math.round(
      (new Date(today + 'T12:00:00').getTime() - new Date(action.due_date + 'T12:00:00').getTime()) / 86400000
    );

    // Mark-done link (ClickUp 86d3tjb94): only issued when the assignee
    // resolved to a real trustee (profiles row, role='trustee'), not a
    // contacts row. Token issuance failing degrades gracefully — the
    // reminder still sends with the original log-in instruction, same as
    // it always has.
    let actionInstruction = `Please log in to MaraeHub to update this action or mark it complete.`;
    if (isTrustee && profileRes.data?.id) {
      const { data: tokenId, error: tokenErr } = await db.rpc('issue_action_reminder_token', {
        p_meeting_action_id: action.id,
        p_trustee_id:        profileRes.data.id,
        p_resolved_name:     name,
        p_resolved_email:    email,
      });
      if (tokenErr) {
        actionSkippedLog.push(`WARN (token issue failed) — "${action.description}": ${tokenErr.message}`);
      } else if (tokenId) {
        const markDoneUrl = `${SUPABASE_URL}/functions/v1/mark-action-done?token=${tokenId}`;
        actionInstruction =
          `Tap here to mark this done: ${markDoneUrl}\n\n` +
          `Or, if you'd rather, log in to MaraeHub to update it yourself.`;
      }
    }

    const body =
      `Tēnā koe ${name},\n\n` +
      `This is a reminder that an action assigned to you from a meeting is now ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue.\n\n` +
      `Meeting: ${meeting?.title ?? 'Unknown meeting'}\n` +
      `Action: ${action.description}\n` +
      `Due: ${fmtDate(action.due_date)}\n\n` +
      actionInstruction +
      footer();

    await notify([email], `Overdue action reminder — ${action.description}`, body);
    actionReminderLog.push(`SENT — "${action.description}" to ${name} (${email})`);
    await db.from('meeting_actions').update({ last_reminded_at: new Date().toISOString() }).eq('id', action.id);
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

  // ── Null-value drift check (ClickUp 86d3u7790, Stage 1) ─────────────────
  // The 6 field/table pairs from the null-field crash audit (commits
  // f89e76d, a345f77), narrowed to the 7 fields the app's own code actually
  // validates as required — a null there can only mean something bypassed
  // that validation (direct SQL, a migration, a regression), not routine
  // use. The other 8 audited fields (all of meetings', plus
  // resolutions.resolution_number, meeting_actions.assigned_to,
  // interest_register.related_matter) are legitimately optional — the app
  // itself still writes null for them on every blank-field save, so
  // checking those would fire on routine, non-buggy usage and break
  // "silent unless genuine risk found." meetings has no qualifying field
  // under this reading and is correctly absent from this check.
  const [
    resolutionsNull,
    meetingActionsNull,
    interestRegisterNull,
    serviceRemindersNull,
    noticesNull,
  ] = await Promise.all([
    db.from('resolutions').select('id, description').is('description', null),
    db.from('meeting_actions').select('id, description').is('description', null),
    db.from('interest_register').select('id, trustee_name, nature_of_interest').or('trustee_name.is.null,nature_of_interest.is.null'),
    db.from('service_reminders').select('id, type').is('type', null),
    db.from('notices').select('id, title, body').or('title.is.null,body.is.null'),
  ]);

  const driftFindings: { table: string; field: string; id: string }[] = [];

  for (const row of resolutionsNull.data ?? []) {
    driftFindings.push({ table: 'resolutions', field: 'description', id: row.id });
  }
  for (const row of meetingActionsNull.data ?? []) {
    driftFindings.push({ table: 'meeting_actions', field: 'description', id: row.id });
  }
  for (const row of interestRegisterNull.data ?? []) {
    if (row.trustee_name === null) driftFindings.push({ table: 'interest_register', field: 'trustee_name', id: row.id });
    if (row.nature_of_interest === null) driftFindings.push({ table: 'interest_register', field: 'nature_of_interest', id: row.id });
  }
  for (const row of serviceRemindersNull.data ?? []) {
    driftFindings.push({ table: 'service_reminders', field: 'type', id: row.id });
  }
  for (const row of noticesNull.data ?? []) {
    if (row.title === null) driftFindings.push({ table: 'notices', field: 'title', id: row.id });
    if (row.body === null) driftFindings.push({ table: 'notices', field: 'body', id: row.id });
  }

  if (driftFindings.length > 0) {
    const body =
      `Tēnā koutou,\n\n` +
      `MaraeHub's daily data check found ${driftFindings.length} record${driftFindings.length !== 1 ? 's' : ''} with a required field unexpectedly empty. This shouldn't be possible through normal use of the app — worth a look.\n\n` +
      driftFindings.map(f => `- ${f.table}.${f.field} — row ${f.id}`).join('\n') +
      `\n\nPlease check these records directly in the database.` +
      footer();

    await notifyAdmin(`Data drift check — ${driftFindings.length} issue${driftFindings.length !== 1 ? 's' : ''} found`, body);
  }

  await db.from('system_check_log').insert({
    check_name: 'null_value_drift',
    findings_count: driftFindings.length,
    details: driftFindings,
  });

  // ── Orphaned records check (ClickUp 86d3u7790, Stage 2a) ────────────────
  // FK-shaped uuid columns with no enforced foreign key constraint (confirmed
  // via a real information_schema.table_constraints audit, not assumed) —
  // narrowed to the 4 genuine candidates: uuid-typed, non-polymorphic (no
  // companion *_type column), and not already covered by a real FK. Excludes
  // every text-typed "*_by"/"assigned_to" column (freeform names, not row
  // IDs) and every polymorphic *_id/*_type pair (goal_links.link_id,
  // finance_income.source_id, workflow_instances.entity_id,
  // notification_log.entity_id) — a single-table check would be wrong for
  // those since the target table varies by row.
  //
  // PostgREST can't embed across these columns to do the join server-side
  // (no declared FK for it to detect — same root cause as the
  // service_reminders/assets gap found on Opeke, ClickUp 86d3wreta), so this
  // fetches each side and diffs in JS instead.
  const [
    profileIds,
    bookingFeedbackRows,
    feedbackRows,
    riskRegisterRows,
    workflowInstancesRows,
  ] = await Promise.all([
    db.from('profiles').select('id'),
    db.from('booking_feedback').select('id, user_id').not('user_id', 'is', null),
    db.from('feedback').select('id, user_id').not('user_id', 'is', null),
    db.from('risk_register').select('id, trustee_id').not('trustee_id', 'is', null),
    db.from('workflow_instances').select('id, created_by').not('created_by', 'is', null),
  ]);

  const validProfileIds = new Set((profileIds.data ?? []).map(p => p.id));

  // Each of the 5 queries above is checked for .error explicitly. A failed
  // query (e.g. a column that doesn't exist on this project — exactly what
  // happened on Opeke, ClickUp 86d3wreta-adjacent finding logged separately)
  // pushes a distinct schema_error-style finding instead of silently
  // contributing nothing via `?? []`, which would otherwise make a broken
  // check indistinguishable from a genuinely clean one. If profiles itself
  // fails, validProfileIds would be an empty Set — diffing against that
  // would flag every non-null row in every candidate table as a false-
  // positive orphan, so all 4 diff loops are skipped entirely in that case,
  // not just left to run against an empty set.
  const orphanFindings: { table: string; field: string; id?: string; error?: string }[] = [];

  if (profileIds.error) {
    orphanFindings.push({ table: 'profiles', field: 'id', error: 'query failed' });
  }

  if (bookingFeedbackRows.error) {
    orphanFindings.push({ table: 'booking_feedback', field: 'user_id', error: 'query failed' });
  } else if (!profileIds.error) {
    for (const row of bookingFeedbackRows.data ?? []) {
      if (!validProfileIds.has(row.user_id)) orphanFindings.push({ table: 'booking_feedback', field: 'user_id', id: row.id });
    }
  }

  if (feedbackRows.error) {
    orphanFindings.push({ table: 'feedback', field: 'user_id', error: 'query failed' });
  } else if (!profileIds.error) {
    for (const row of feedbackRows.data ?? []) {
      if (!validProfileIds.has(row.user_id)) orphanFindings.push({ table: 'feedback', field: 'user_id', id: row.id });
    }
  }

  if (riskRegisterRows.error) {
    orphanFindings.push({ table: 'risk_register', field: 'trustee_id', error: 'query failed' });
  } else if (!profileIds.error) {
    for (const row of riskRegisterRows.data ?? []) {
      if (!validProfileIds.has(row.trustee_id)) orphanFindings.push({ table: 'risk_register', field: 'trustee_id', id: row.id });
    }
  }

  if (workflowInstancesRows.error) {
    orphanFindings.push({ table: 'workflow_instances', field: 'created_by', error: 'query failed' });
  } else if (!profileIds.error) {
    for (const row of workflowInstancesRows.data ?? []) {
      if (!validProfileIds.has(row.created_by)) orphanFindings.push({ table: 'workflow_instances', field: 'created_by', id: row.id });
    }
  }

  if (orphanFindings.length > 0) {
    const body =
      `Tēnā koutou,\n\n` +
      `MaraeHub's daily orphaned-records check found ${orphanFindings.length} issue${orphanFindings.length !== 1 ? 's' : ''} — either a dangling reference or a check that failed to run. This shouldn't happen through normal use of the app — worth a look.\n\n` +
      orphanFindings.map(f => f.error
        ? `- ${f.table}.${f.field} — check could not run (${f.error})`
        : `- ${f.table}.${f.field} — row ${f.id}`
      ).join('\n') +
      `\n\nPlease check these records directly in the database.` +
      footer();

    await notifyAdmin(`Orphaned record check — ${orphanFindings.length} issue${orphanFindings.length !== 1 ? 's' : ''} found`, body);
  }

  await db.from('system_check_log').insert({
    check_name: 'orphaned_records',
    findings_count: orphanFindings.length,
    details: orphanFindings,
  });

  // ── Single-row-table invariant check (ClickUp 86d3u7790, Stage 2b) ──────
  // Real incident this protects against: marae_settings silently had 2
  // rows, and the app picked one at random (whichever Postgres returned
  // first to an unordered .limit(1).single()/.maybeSingle()), showing the
  // wrong marae's details.
  //
  // Audited every .single()/.maybeSingle() call across src/ (16 total) for
  // the specific pattern that let that happen: no filter at all before the
  // call, so nothing narrows the result to one row on its own — the table
  // itself has to actually hold exactly one row. 14 of 16 are ordinary
  // filtered per-row lookups (.eq('id', x) etc.) and aren't candidates.
  // Exactly 2 are genuine unscoped singleton reads: marae_settings and
  // finance_balance_sheet (FinanceManager.js, drives bsId for later
  // update/insert calls). Neither has an entity_id/tenant-scoping column
  // (confirmed via information_schema.columns), so both are real global-
  // per-project singletons, not "one per something."
  //
  // Flags count > 1 only, not count !== 1. finance_balance_sheet
  // legitimately has 0 rows until a trustee first saves the balance sheet
  // form (FinanceManager.js: `if (bs) {...}` else empty form, insert on
  // first save) — flagging 0 would be a false alarm on a normal, non-buggy
  // empty state, breaking "silent unless genuine risk found." Only a
  // duplicate row (the actual incident this check exists to catch) is a
  // genuine finding.
  const [
    maraeSettingsCount,
    financeBalanceSheetCount,
  ] = await Promise.all([
    db.from('marae_settings').select('id', { count: 'exact', head: true }),
    db.from('finance_balance_sheet').select('id', { count: 'exact', head: true }),
  ]);

  const singleRowFindings: { table: string; row_count?: number; error?: string }[] = [];

  if (maraeSettingsCount.error) {
    singleRowFindings.push({ table: 'marae_settings', error: 'query failed' });
  } else if ((maraeSettingsCount.count ?? 0) > 1) {
    singleRowFindings.push({ table: 'marae_settings', row_count: maraeSettingsCount.count ?? undefined });
  }

  if (financeBalanceSheetCount.error) {
    singleRowFindings.push({ table: 'finance_balance_sheet', error: 'query failed' });
  } else if ((financeBalanceSheetCount.count ?? 0) > 1) {
    singleRowFindings.push({ table: 'finance_balance_sheet', row_count: financeBalanceSheetCount.count ?? undefined });
  }

  if (singleRowFindings.length > 0) {
    const body =
      `Tēnā koutou,\n\n` +
      `MaraeHub's daily data check found ${singleRowFindings.length} table${singleRowFindings.length !== 1 ? 's' : ''} that should hold exactly one row but ${singleRowFindings.length !== 1 ? "don't" : "doesn't"}. This shouldn't be possible through normal use of the app — worth a look.\n\n` +
      singleRowFindings.map(f => f.error
        ? `- ${f.table} — check could not run (${f.error})`
        : `- ${f.table} — ${f.row_count} rows found, expected exactly 1`
      ).join('\n') +
      `\n\nPlease check this table directly in the database.` +
      footer();

    await notifyAdmin(`Single-row table check — ${singleRowFindings.length} issue${singleRowFindings.length !== 1 ? 's' : ''} found`, body);
  }

  await db.from('system_check_log').insert({
    check_name: 'single_row_invariant',
    findings_count: singleRowFindings.length,
    details: singleRowFindings,
  });

  // ── Cron health check (ClickUp 86d3u7790, Stage 2c — Layers 1 + 2) ───────
  // Confirms the monthly lock-monthly-kpi-snapshot cron job is actually
  // firing AND actually doing its work, not just registered — registration
  // alone (cron.job.active) says nothing about whether runs are succeeding,
  // and (per Layer 1's own limitation below) a "succeeded" dispatch says
  // nothing about whether the function itself completed.
  //
  // Layer 1 — did cron dispatch it? check_cron_job_last_success() (migration
  // 20260803000000) reads cron.job_run_details via a SECURITY DEFINER
  // wrapper, since PostgREST has no direct access to the cron schema
  // (confirmed empirically — see that migration's header). net.http_post is
  // fire-and-forget, so "succeeded" here only proves the HTTP call was
  // dispatched without error, not that the edge function itself completed.
  //
  // Layer 2 — did the function's own work actually land? Cross-references a
  // real row in module_kpi_snapshots, the job's own output table — the same
  // principle Stage 1 already established with system_check_log. Keyed on
  // locked_at (the real insert timestamp), never snapshot_month —
  // snapshot_month is deliberately the first day of the *previous* calendar
  // month (firstDayOfPreviousMonth(), lock-monthly-kpi-snapshot/index.ts),
  // confirmed live on both projects (2026-08-01 run → snapshot_month
  // 2026-07-01) — using it here would misread every legitimate row as
  // ~30+ days stale.
  //
  // Both layers write into one cronFindings array / one system_check_log
  // row (check_name: 'cron_health'), tagged by `layer` — matches the task's
  // original design ("flag a finding if either layer fails").
  //
  // Still unresolved, deliberately out of scope here: this check cannot
  // validate check-deadlines' own liveness (if check-deadlines itself stops
  // firing, so does the code that would notice) — neither option the task
  // raised for that has been decided. Tracked in 86d3u7790, not closed by
  // this commit.
  //
  // 35-day threshold (both layers), not 31: the job runs on the 1st of each
  // month at 00:05 UTC. The longest legitimate gap between two successful
  // runs is one full calendar month, plus this check itself only runs once
  // a day at 08:00 UTC — 35 days gives slack for month-length variance and
  // the daily cadence of this check without masking a genuinely missed run.
  const { data: lastCronSuccess, error: cronErr } = await db.rpc(
    'check_cron_job_last_success',
    { job_name_pattern: '%lock-monthly-kpi-snapshot%' },
  );

  const cronFindings: { job: string; layer: 1 | 2; last_success: string | null; days_since: number | null; error?: string }[] = [];

  if (cronErr) {
    cronFindings.push({ job: 'lock-monthly-kpi-snapshot', layer: 1, last_success: null, days_since: null, error: cronErr.message });
  } else {
    const daysSince = lastCronSuccess
      ? Math.floor((Date.now() - new Date(lastCronSuccess).getTime()) / 86400000)
      : null;

    // null means the job has never once succeeded — as much a finding as a
    // stale one, and daysSince has no numeric value to threshold against.
    if (daysSince === null || daysSince > 35) {
      cronFindings.push({
        job:          'lock-monthly-kpi-snapshot',
        layer:        1,
        last_success: lastCronSuccess,
        days_since:   daysSince,
      });
    }
  }

  const { data: lastSnapshot, error: snapshotErr } = await db
    .from('module_kpi_snapshots')
    .select('locked_at')
    .order('locked_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (snapshotErr) {
    cronFindings.push({ job: 'lock-monthly-kpi-snapshot', layer: 2, last_success: null, days_since: null, error: snapshotErr.message });
  } else {
    const daysSinceSnapshot = lastSnapshot?.locked_at
      ? Math.floor((Date.now() - new Date(lastSnapshot.locked_at).getTime()) / 86400000)
      : null;

    if (daysSinceSnapshot === null || daysSinceSnapshot > 35) {
      cronFindings.push({
        job:          'lock-monthly-kpi-snapshot',
        layer:        2,
        last_success: lastSnapshot?.locked_at ?? null,
        days_since:   daysSinceSnapshot,
      });
    }
  }

  if (cronFindings.length > 0) {
    const layerLabel = (l: 1 | 2) => l === 1 ? 'cron dispatch' : 'function completion';
    const body =
      `Tēnā koutou,\n\n` +
      `MaraeHub's daily cron health check found ${cronFindings.length} issue${cronFindings.length !== 1 ? 's' : ''} with a scheduled job. This shouldn't happen through normal operation — worth a look.\n\n` +
      cronFindings.map(f => f.error
        ? `- ${f.job} (layer ${f.layer}: ${layerLabel(f.layer)}) — check could not run (${f.error})`
        : `- ${f.job} (layer ${f.layer}: ${layerLabel(f.layer)}) — last success: ${f.last_success ?? 'never'}${f.days_since !== null ? ` (${f.days_since} days ago)` : ''}`
      ).join('\n') +
      `\n\nPlease check this job directly in the database (cron.job_run_details, module_kpi_snapshots).` +
      footer();

    await notifyAdmin(`Cron health check — ${cronFindings.length} issue${cronFindings.length !== 1 ? 's' : ''} found`, body);
  }

  await db.from('system_check_log').insert({
    check_name: 'cron_health',
    findings_count: cronFindings.length,
    details: cronFindings,
  });

  // ── Orphaned auth accounts check (ClickUp 86d3u7790) ──────────────────────
  // Catches the bug class behind Tineka's original login dead-end: an
  // auth.users row with no matching profiles row surfaces in-app as a
  // permanent "Could not load your profile" failure. auth schema isn't
  // reachable via PostgREST, so this goes through a SECURITY DEFINER RPC
  // (public.find_orphaned_auth_users(), migration 20260805010000) - same
  // wall and same fix pattern as Stage 2c's cron.job access.
  //
  // Checks all of auth.users, not filtered to trustees: when the profile
  // row is missing, role is unknowable (it lives on profiles, not
  // auth.users), and every case hits the same dead-end regardless of what
  // role they'd have had.
  const { data: orphanedAuthRows, error: orphanedAuthErr } = await db.rpc('find_orphaned_auth_users');

  const orphanedAuthFindings: { id?: string; email?: string; created_at?: string; error?: string }[] = [];

  if (orphanedAuthErr) {
    orphanedAuthFindings.push({ error: 'query failed' });
  } else {
    for (const row of orphanedAuthRows ?? []) {
      orphanedAuthFindings.push({ id: row.id, email: row.email, created_at: row.created_at });
    }
  }

  if (orphanedAuthFindings.length > 0) {
    const body =
      `Tēnā koutou,\n\n` +
      `MaraeHub's daily check found ${orphanedAuthFindings.length} auth account${orphanedAuthFindings.length !== 1 ? 's' : ''} with no matching profile — anyone in this state hits a permanent "Could not load your profile" dead-end on login.\n\n` +
      orphanedAuthFindings.map(f => f.error
        ? `- check could not run (${f.error})`
        : `- ${f.email} — account created ${f.created_at}, id ${f.id}`
      ).join('\n') +
      `\n\nRecommended fix: insert a profiles row for each (same shape as the 2026-06-17 backfill), or investigate why one didn't exist already.` +
      footer();

    await notifyAdmin(`Orphaned auth account check — ${orphanedAuthFindings.length} issue${orphanedAuthFindings.length !== 1 ? 's' : ''} found`, body);
  }

  await db.from('system_check_log').insert({
    check_name: 'orphaned_auth_users',
    findings_count: orphanedAuthFindings.length,
    details: orphanedAuthFindings,
  });

  // ── Schema drift check (ClickUp 86d3u7790, Stage 2d) ──────────────────────
  // schema.sql vs. live database - a table/column existing in one but not
  // the other. information_schema isn't reachable via PostgREST (confirmed:
  // HTTP 406 on Accept-Profile: information_schema), same wall as cron/auth,
  // so this goes through a SECURITY DEFINER RPC
  // (public.get_public_schema_columns(), migration 20260811000000),
  // mirroring the pg_class/pg_attribute query already used to build
  // schema.sql itself.
  //
  // EXPECTED_SCHEMA is generated from schema.sql by
  // scripts/generate-expected-schema.js, committed as expectedSchema.ts -
  // not read live, since check-deadlines has no filesystem access to the
  // repo at runtime. Nothing enforces the generator gets re-run when
  // schema.sql changes - a named, not-solved limitation (see ClickUp task).
  //
  // Scoped to table/column names only, not types/constraints/defaults -
  // matches exactly what was asked. Runs identically on both projects: a
  // real difference between them (e.g. Tineka lagging behind Opeke on an
  // untracked migration) is a genuine finding, not a false positive.
  const { data: liveColumnsRows, error: schemaDriftErr } = await db.rpc('get_public_schema_columns');

  const schemaDriftFindings: { type: string; table: string; column?: string; error?: string }[] = [];

  if (schemaDriftErr) {
    schemaDriftFindings.push({ type: 'query_failed', table: '(all)', error: schemaDriftErr.message });
  } else {
    const liveSchema: Record<string, Set<string>> = {};
    for (const row of liveColumnsRows ?? []) {
      if (!liveSchema[row.table_name]) liveSchema[row.table_name] = new Set();
      liveSchema[row.table_name].add(row.column_name);
    }

    const expectedTables = Object.keys(EXPECTED_SCHEMA);
    const liveTables = Object.keys(liveSchema);

    for (const table of expectedTables) {
      if (!liveSchema[table]) schemaDriftFindings.push({ type: 'missing_table_in_db', table });
    }
    for (const table of liveTables) {
      if (!EXPECTED_SCHEMA[table]) schemaDriftFindings.push({ type: 'missing_table_in_schema_sql', table });
    }

    for (const table of expectedTables) {
      if (!liveSchema[table]) continue; // already flagged above as missing_table_in_db
      for (const column of EXPECTED_SCHEMA[table]) {
        if (!liveSchema[table].has(column)) {
          schemaDriftFindings.push({ type: 'missing_column_in_db', table, column });
        }
      }
      for (const column of liveSchema[table]) {
        if (!EXPECTED_SCHEMA[table].includes(column)) {
          schemaDriftFindings.push({ type: 'missing_column_in_schema_sql', table, column });
        }
      }
    }
  }

  if (schemaDriftFindings.length > 0) {
    const body =
      `Tēnā koutou,\n\n` +
      `MaraeHub's daily schema check found ${schemaDriftFindings.length} difference${schemaDriftFindings.length !== 1 ? 's' : ''} between schema.sql and the live database. This shouldn't happen through normal use of the app — worth a look.\n\n` +
      schemaDriftFindings.map(f => f.error
        ? `- check could not run (${f.error})`
        : f.column
          ? `- ${f.type} — ${f.table}.${f.column}`
          : `- ${f.type} — ${f.table}`
      ).join('\n') +
      `\n\nPlease update schema.sql or the live database directly, then regenerate expectedSchema.ts (scripts/generate-expected-schema.js) if schema.sql changed.` +
      footer();

    await notifyAdmin(`Schema drift check — ${schemaDriftFindings.length} difference${schemaDriftFindings.length !== 1 ? 's' : ''} found`, body);
  }

  await db.from('system_check_log').insert({
    check_name: 'schema_drift',
    findings_count: schemaDriftFindings.length,
    details: schemaDriftFindings,
  });

  // ── Security/access-control check (ClickUp 86d3u7790, Stage 3) ───────────
  // Check A: any RLS policy in public granting the anon role that isn't on
  // the reviewed allowlist below. Check B: any SECURITY DEFINER function
  // whose actual grants don't match the reviewed allowlist below.
  //
  // Allowlists are maintained here, not derived from migration-file
  // comments - check-deadlines has no filesystem/git access to read those
  // at runtime, and this session's own real bugs proved comments can't be
  // trusted even when they exist (find_orphaned_auth_users' comment claimed
  // a lockdown that wasn't real for a full week). Each entry below was
  // individually verified live before being added, not assumed correct.
  const ALLOWED_ANON_POLICIES: { table: string; policy: string }[] = [
    // Deliberately empty as of 12 August 2026 - confirmed zero anon-role
    // policies exist on either project right now. Both real instances found
    // this session (profiles, and indirectly the trustee-login-activity
    // RPC) are already fixed. Add an entry here only after confirming a
    // genuine, deliberate need - e.g. a real public-facing booking flow -
    // never as a default to silence a finding.
  ];

  const ALLOWED_SECURITY_DEFINER_GRANTS: { function: string; grantees: string[]; reason: string }[] = [
    { function: 'find_orphaned_auth_users', grantees: ['postgres', 'service_role'],
      reason: 'Returns real trustee email addresses - locked 5 Aug 2026' },
    { function: 'get_public_schema_columns', grantees: ['postgres', 'service_role'],
      reason: 'Schema introspection - locked 11 Aug 2026' },
    { function: 'issue_action_reminder_token', grantees: ['postgres', 'service_role'],
      reason: 'Mediated by mark-action-done edge function, never called directly by clients' },
    { function: 'redeem_action_reminder_token', grantees: ['postgres', 'service_role'],
      reason: 'Mediated by mark-action-done edge function, never called directly by clients' },
    { function: 'get_trustee_login_activity', grantees: ['postgres', 'service_role'],
      reason: 'Returns real trustee PII - locked 12 Aug 2026, closed a confirmed live exploit on Opeke' },
    { function: 'check_cron_job_last_success', grantees: ['postgres', 'service_role'],
      reason: 'Locked 12 Aug 2026 - leaked cron run timing to anon, no legitimate reason found for it to stay open' },
    { function: 'get_meeting_entity_id', grantees: ['postgres', 'service_role', 'authenticated'],
      reason: 'Confirmed via pg_policies: referenced directly inside resolutions/meeting_actions RLS policies. authenticated needs EXECUTE for real trustee queries against those tables to work under RLS at all. anon/public revoked 12 Aug 2026 - no anon-role policy anywhere references either table.' },
    { function: 'handle_new_auth_user', grantees: ['postgres', 'service_role', 'anon', 'authenticated', 'PUBLIC'],
      reason: 'Trigger function - confirmed empirically (direct call attempt) that Postgres refuses non-trigger invocation regardless of grants. Broad grant is structurally inert; left unchanged rather than churned for no real security benefit.' },
    { function: 'update_last_sign_in', grantees: ['postgres', 'service_role', 'anon', 'authenticated', 'PUBLIC'],
      reason: 'Same as handle_new_auth_user - trigger function, confirmed empirically uncallable directly regardless of grants. Tineka-only; will simply not appear in this RPC\'s results on Opeke.' },
    { function: 'get_anon_granted_policies', grantees: ['postgres', 'service_role'],
      reason: 'This check\'s own Check-A RPC - locked to service_role from creation, 12 Aug 2026' },
    { function: 'get_security_definer_function_grants', grantees: ['postgres', 'service_role'],
      reason: 'This check\'s own Check-B RPC - locked to service_role from creation, 12 Aug 2026' },
    { function: 'get_storage_buckets', grantees: ['postgres', 'service_role'],
      reason: 'Stage 4 process/config safety check\'s own RPC - locked to service_role from creation, 14 Aug 2026. Caught flagging itself in this same allowlist during Stage 4\'s own manual verification, same self-referential gap Check-A/Check-B hit during Stage 3\'s build.' },
  ];

  function sameGrantSet(a: string[], b: string[]): boolean {
    const as = new Set(a);
    const bs = new Set(b);
    return as.size === bs.size && [...as].every(x => bs.has(x));
  }

  const [anonPoliciesRes, secDefGrantsRes] = await Promise.all([
    db.rpc('get_anon_granted_policies'),
    db.rpc('get_security_definer_function_grants'),
  ]);

  const securityFindings: { type: string; table?: string; policy?: string; function?: string; grantees?: string[]; error?: string }[] = [];

  if (anonPoliciesRes.error) {
    securityFindings.push({ type: 'anon_policy_check_failed', error: anonPoliciesRes.error.message });
  } else {
    for (const row of anonPoliciesRes.data ?? []) {
      const allowed = ALLOWED_ANON_POLICIES.some(a => a.table === row.table_name && a.policy === row.policy_name);
      if (!allowed) {
        securityFindings.push({ type: 'anon_policy_not_allowlisted', table: row.table_name, policy: row.policy_name });
      }
    }
  }

  if (secDefGrantsRes.error) {
    securityFindings.push({ type: 'security_definer_grant_check_failed', error: secDefGrantsRes.error.message });
  } else {
    for (const row of secDefGrantsRes.data ?? []) {
      const entry = ALLOWED_SECURITY_DEFINER_GRANTS.find(a => a.function === row.function_name);
      if (!entry) {
        securityFindings.push({ type: 'security_definer_not_allowlisted', function: row.function_name, grantees: row.grantees });
      } else if (!sameGrantSet(entry.grantees, row.grantees)) {
        securityFindings.push({ type: 'security_definer_grant_mismatch', function: row.function_name, grantees: row.grantees });
      }
    }
  }

  if (securityFindings.length > 0) {
    const body =
      `Tēnā koutou,\n\n` +
      `MaraeHub's daily security check found ${securityFindings.length} issue${securityFindings.length !== 1 ? 's' : ''} with access control. This shouldn't happen through normal use of the app — worth a look.\n\n` +
      securityFindings.map(f => f.error
        ? `- ${f.type} — check could not run (${f.error})`
        : f.function
          ? `- ${f.type} — ${f.function} (grantees: ${f.grantees?.join(', ')})`
          : `- ${f.type} — ${f.table}.${f.policy}`
      ).join('\n') +
      `\n\nPlease review this directly in the database.` +
      footer();

    await notifyAdmin(`Security/access-control check — ${securityFindings.length} issue${securityFindings.length !== 1 ? 's' : ''} found`, body);
  }

  await db.from('system_check_log').insert({
    check_name: 'security_access_control',
    findings_count: securityFindings.length,
    details: securityFindings,
  });

  // ── STAGE 4: PROCESS/CONFIG SAFETY ──────────────────────────────────────
  // Real gaps found while designing this stage, not theoretical: Tineka was
  // missing the meeting-attachments storage bucket entirely (CommitteeMinutes.js
  // depends on it), and missing the COMMUNITY_LOGIN_TOKEN secret entirely
  // (community-auto-login depends on it). Both confirmed live before building.

  const EXPECTED_BUCKETS = [
    'documents', 'meeting-attachments', 'compliance-docs', 'finance-receipts', 'contractor-docs',
  ];

  const REQUIRED_SECRETS: { name: string; format?: RegExp }[] = [
    { name: 'ADMIN_ALERT_EMAIL', format: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    { name: 'RESEND_API_KEY' },
    { name: 'FROM_EMAIL',        format: /^([^<>]+<)?[^\s@]+@[^\s@]+\.[^\s@]+>?$/ },
    { name: 'FRONTEND_URL',      format: /^https?:\/\// },
    { name: 'COMMUNITY_LOGIN_TOKEN' },
  ];

  const processConfigFindings: { type: string; bucket?: string; secret?: string; error?: string }[] = [];

  const bucketsRes = await db.rpc('get_storage_buckets');
  if (bucketsRes.error) {
    processConfigFindings.push({ type: 'storage_bucket_check_failed', error: bucketsRes.error.message });
  } else {
    const liveBucketIds = new Set((bucketsRes.data ?? []).map((b: { id: string }) => b.id));
    for (const bucket of EXPECTED_BUCKETS) {
      if (!liveBucketIds.has(bucket)) {
        processConfigFindings.push({ type: 'missing_storage_bucket', bucket });
      }
    }
  }

  for (const secret of REQUIRED_SECRETS) {
    const value = Deno.env.get(secret.name);
    if (!value) {
      processConfigFindings.push({ type: 'missing_required_secret', secret: secret.name });
    } else if (secret.format && !secret.format.test(value)) {
      processConfigFindings.push({ type: 'malformed_required_secret', secret: secret.name });
    }
  }

  if (processConfigFindings.length > 0) {
    const body =
      `Tēnā koutou,\n\n` +
      `MaraeHub's daily process/config safety check found ${processConfigFindings.length} issue${processConfigFindings.length !== 1 ? 's' : ''}. This shouldn't happen through normal use of the app — worth a look.\n\n` +
      processConfigFindings.map(f => f.error
        ? `- ${f.type} — check could not run (${f.error})`
        : f.bucket
          ? `- ${f.type} — bucket: ${f.bucket}`
          : `- ${f.type} — secret: ${f.secret}`
      ).join('\n') +
      `\n\nPlease review this directly.` +
      footer();

    await notifyAdmin(`Process/config safety check — ${processConfigFindings.length} issue${processConfigFindings.length !== 1 ? 's' : ''} found`, body);
  }

  await db.from('system_check_log').insert({
    check_name: 'process_config_safety',
    findings_count: processConfigFindings.length,
    details: processConfigFindings,
  });

  return new Response(
    JSON.stringify({
      checked:           dueDate,
      today,
      null_drift_findings: driftFindings.length,
      orphaned_records_findings: orphanFindings.length,
      single_row_invariant_findings: singleRowFindings.length,
      cron_health_findings: cronFindings.length,
      orphaned_auth_users_findings: orphanedAuthFindings.length,
      schema_drift_findings: schemaDriftFindings.length,
      security_access_control_findings: securityFindings.length,
      process_config_safety_findings: processConfigFindings.length,
      grants:            grants?.length ?? 0,
      reminders:         reminders?.length ?? 0,
      meeting_action_reminders_sent:    actionReminderLog.length,
      meeting_action_reminders_log:     actionReminderLog,
      meeting_action_reminders_skipped: actionSkippedLog,
      trustees:          trusteeEmails.length,
      workflows_created: workflowLog.length,
      workflows_log:     workflowLog,
      workflows_skipped: skippedLog,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
});
