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

    await notify(trusteeEmails, `Data drift check — ${driftFindings.length} issue${driftFindings.length !== 1 ? 's' : ''} found`, body);
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

    await notify(trusteeEmails, `Orphaned record check — ${orphanFindings.length} issue${orphanFindings.length !== 1 ? 's' : ''} found`, body);
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

    await notify(trusteeEmails, `Single-row table check — ${singleRowFindings.length} issue${singleRowFindings.length !== 1 ? 's' : ''} found`, body);
  }

  await db.from('system_check_log').insert({
    check_name: 'single_row_invariant',
    findings_count: singleRowFindings.length,
    details: singleRowFindings,
  });

  return new Response(
    JSON.stringify({
      checked:           dueDate,
      today,
      null_drift_findings: driftFindings.length,
      orphaned_records_findings: orphanFindings.length,
      single_row_invariant_findings: singleRowFindings.length,
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
