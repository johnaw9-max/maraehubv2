/**
 * lock-monthly-kpi-snapshot — scheduled monthly via pg_cron, same pattern as
 * check-deadlines (see supabase/migrations/20260609205052_schedule_deadline_checks.sql).
 *
 * Runs shortly after each month rolls over and locks in one row in
 * module_kpi_snapshots for the month that just ended, computing the same
 * four percentages shown live on Board View (BoardDashboard.js):
 *   - compliance_pct : % of compliance_items not overdue and not due within 30 days
 *   - risk_pct       : % of open (non-Closed) risk_register rows with controls set
 *   - assets_pct     : % of assets with no overdue service_reminders row
 *   - goals_pct      : % of active (non-not_started) goals that are on-track or completed
 *
 * Uses ON CONFLICT DO NOTHING on snapshot_month so re-running (e.g. a manual
 * backfill call) never overwrites an already-locked month.
 *
 * Environment variables required (set automatically by Supabase):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function goalLight(g: { status: string; target_date: string | null }, today: Date, in14: Date): 'green' | 'orange' | 'red' {
  const t = g.target_date ? new Date(g.target_date + 'T12:00:00') : null;
  if (g.status === 'completed') return 'green';
  if (g.status === 'at_risk') return 'orange';
  if (g.status === 'not_started') return (t && t < today) ? 'red' : 'green';
  if (t && t < today) return 'red';
  if (t && t <= in14) return 'orange';
  return 'green';
}

function firstDayOfPreviousMonth(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth(); // 0-indexed; d.getMonth() - 1 is last month
  const prev = new Date(y, m - 1, 1);
  return prev.toISOString().split('T')[0];
}

serve(async (_req) => {
  const json = (body: object, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const in30 = new Date(today); in30.setDate(in30.getDate() + 30);
    const in14 = new Date(today); in14.setDate(in14.getDate() + 14);

    const [compRes, riskRes, assetRes, remRes, goalsRes] = await Promise.all([
      admin.from('compliance_items').select('id, due_date'),
      admin.from('risk_register').select('id, status, controls'),
      admin.from('assets').select('id'),
      admin.from('service_reminders').select('id, asset_id, due_date'),
      admin.from('goals').select('id, status, target_date'),
    ]);

    if (compRes.error) return json({ error: compRes.error.message }, 500);
    if (riskRes.error) return json({ error: riskRes.error.message }, 500);
    if (assetRes.error) return json({ error: assetRes.error.message }, 500);
    if (remRes.error) return json({ error: remRes.error.message }, 500);
    if (goalsRes.error) return json({ error: goalsRes.error.message }, 500);

    const compliance = compRes.data || [];
    const risks      = riskRes.data || [];
    const assets     = assetRes.data || [];
    const reminders  = remRes.data || [];
    const goals      = goalsRes.data || [];

    // ── Compliance % ──────────────────────────────────────────────────────
    const overdueCompliance   = compliance.filter(c => c.due_date && new Date(c.due_date + 'T12:00:00') < today);
    const dueSoonCompliance   = compliance.filter(c => c.due_date && new Date(c.due_date + 'T12:00:00') >= today && new Date(c.due_date + 'T12:00:00') <= in30);
    const compliantCompliance = compliance.length - overdueCompliance.length - dueSoonCompliance.length;
    const compliancePct = compliance.length ? Math.round((compliantCompliance / compliance.length) * 100) : 100;

    // ── Risk Register % ───────────────────────────────────────────────────
    const openRisks             = risks.filter(r => r.status !== 'Closed');
    const openRisksWithControls = openRisks.filter(r => r.controls);
    const riskPct = openRisks.length ? Math.round((openRisksWithControls.length / openRisks.length) * 100) : 100;

    // ── Assets % ──────────────────────────────────────────────────────────
    const overdueReminders  = reminders.filter(r => r.due_date && new Date(r.due_date + 'T12:00:00') < today);
    const assetsWithOverdue = new Set(overdueReminders.map(r => r.asset_id));
    const assetsPct = assets.length ? Math.round(((assets.length - assetsWithOverdue.size) / assets.length) * 100) : 100;

    // ── Goals % ───────────────────────────────────────────────────────────
    const activeGoals           = goals.filter(g => g.status !== 'not_started');
    const goalsOnTrackOrComplete = activeGoals.filter(g => goalLight(g, today, in14) === 'green' || g.status === 'completed');
    const goalsPct = activeGoals.length ? Math.round((goalsOnTrackOrComplete.length / activeGoals.length) * 100) : 100;

    const snapshotMonth = firstDayOfPreviousMonth(today);

    const { error: insertError } = await admin
      .from('module_kpi_snapshots')
      .upsert({
        snapshot_month: snapshotMonth,
        compliance_pct: compliancePct,
        risk_pct:       riskPct,
        assets_pct:     assetsPct,
        goals_pct:      goalsPct,
      }, { onConflict: 'snapshot_month', ignoreDuplicates: true });

    if (insertError) return json({ error: insertError.message }, 500);

    return json({
      success: true,
      snapshot_month: snapshotMonth,
      compliance_pct: compliancePct,
      risk_pct:       riskPct,
      assets_pct:     assetsPct,
      goals_pct:      goalsPct,
    });

  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
