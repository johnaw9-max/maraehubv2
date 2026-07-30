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
 * Also locks 3 finance fields from Xero's Balance Sheet report, when the
 * marae has an active Xero connection (net_assets, total_assets,
 * total_liabilities -- see ClickUp 86d3vc60z). These are nullable and
 * degrade gracefully: not Xero-connected, a token refresh failure, or any
 * Xero API error all result in null for these 3 fields WITHOUT blocking
 * the four percentages above from locking normally. Reuses the same
 * label-matching parse approach (not RowType-restricted) proven in
 * xero-financials/index.ts's parseBalanceSheet(), duplicated here rather
 * than shared via import since this codebase has no cross-function shared
 * module convention.
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

const XERO_TOKEN_URL    = 'https://identity.xero.com/connect/token';
const XERO_API_BASE     = 'https://api.xero.com/api.xro/2.0';
const REFRESH_BUFFER_MS = 2 * 60 * 1000;
const XERO_CLIENT_ID     = Deno.env.get('XERO_CLIENT_ID') ?? '';
const XERO_CLIENT_SECRET = Deno.env.get('XERO_CLIENT_SECRET') ?? '';

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

// Deliberately duplicated from xero-financials/index.ts rather than shared
// via an import: this codebase has no _shared/ folder convention across
// edge functions (checked -- every function here is self-contained), and
// introducing one just for this would be a bigger change than the task
// warrants under tonight's time pressure. Kept minimal: only the 3 fields
// this function actually stores, not the full parseBalanceSheet() from
// xero-financials (which also returns totalEquity/totalBank -- not needed
// here since those aren't being snapshotted).
function collectLabeledRows(rows: unknown, acc: Record<string, string> = {}): Record<string, string> {
  for (const row of (rows as any[]) ?? []) {
    if ((row.RowType === 'Row' || row.RowType === 'SummaryRow') && Array.isArray(row.Cells) && row.Cells.length >= 2) {
      const label = row.Cells[0]?.Value;
      const value = row.Cells[1]?.Value;
      if (label) acc[label] = value;
    }
    if (Array.isArray(row.Rows)) collectLabeledRows(row.Rows, acc);
  }
  return acc;
}

function toAmount(value: string | undefined): number | null {
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

// Never throws -- always resolves to a value object or null, so a Xero
// failure of any kind degrades gracefully rather than blocking the rest
// of the monthly lock. Logs the reason either way for later debugging.
async function fetchBalanceSheetSnapshot(admin: any): Promise<{ netAssets: number; totalAssets: number; totalLiabilities: number } | null> {
  try {
    const { data: connection, error: connError } = await admin
      .from('xero_connections')
      .select('id, tenant_id, access_token, refresh_token, access_token_expires_at')
      .eq('status', 'active')
      .is('entity_id', null)
      .maybeSingle();

    if (connError) {
      console.error('[lock-monthly-kpi-snapshot] xero_connections lookup failed:', connError.message);
      return null;
    }
    if (!connection) {
      console.log('[lock-monthly-kpi-snapshot] no active Xero connection -- balance sheet fields will be null this month');
      return null;
    }

    let accessToken = connection.access_token;
    const expiresAt = new Date(connection.access_token_expires_at).getTime();

    if (Date.now() >= expiresAt - REFRESH_BUFFER_MS) {
      const refreshRes = await fetch(XERO_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${btoa(`${XERO_CLIENT_ID}:${XERO_CLIENT_SECRET}`)}`,
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: connection.refresh_token,
        }).toString(),
      });

      if (!refreshRes.ok) {
        console.error('[lock-monthly-kpi-snapshot] Xero token refresh failed:', refreshRes.status);
        return null;
      }

      const refreshed = await refreshRes.json();
      accessToken = refreshed.access_token;

      const { error: updateError } = await admin
        .from('xero_connections')
        .update({
          access_token: refreshed.access_token,
          refresh_token: refreshed.refresh_token,
          access_token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
          last_refreshed_at: new Date().toISOString(),
        })
        .eq('id', connection.id);

      if (updateError) {
        console.error('[lock-monthly-kpi-snapshot] failed to persist refreshed Xero token:', updateError.message);
        return null;
      }
    }

    const balRes = await fetch(`${XERO_API_BASE}/Reports/BalanceSheet`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Xero-Tenant-Id': connection.tenant_id,
        'Accept': 'application/json',
      },
    });

    if (!balRes.ok) {
      console.error('[lock-monthly-kpi-snapshot] Balance Sheet fetch failed:', balRes.status);
      return null;
    }

    const balData = await balRes.json();
    const labeled = collectLabeledRows(balData?.Reports?.[0]?.Rows);

    const netAssets        = toAmount(labeled['Net Assets']);
    const totalAssets      = toAmount(labeled['Total Assets']);
    const totalLiabilities = toAmount(labeled['Total Liabilities']);

    if (netAssets === null) {
      console.error('[lock-monthly-kpi-snapshot] Net Assets row missing or unparseable -- treating as not available this month');
      return null;
    }

    return {
      netAssets,
      totalAssets: totalAssets ?? 0,
      totalLiabilities: totalLiabilities ?? 0,
    };
  } catch (err) {
    console.error('[lock-monthly-kpi-snapshot] unexpected error fetching Balance Sheet:', (err as Error).message);
    return null;
  }
}

serve(async (_req) => {
  const json = (body: object, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const in30 = new Date(today); in30.setDate(in30.getDate() + 30);
    const in14 = new Date(today); in14.setDate(in14.getDate() + 14);

    const [compRes, riskRes, assetRes, remRes, goalsRes, balanceSheet] = await Promise.all([
      admin.from('compliance_items').select('id, due_date'),
      admin.from('risk_register').select('id, status, controls'),
      admin.from('assets').select('id'),
      admin.from('service_reminders').select('id, asset_id, due_date'),
      admin.from('goals').select('id, status, target_date'),
      fetchBalanceSheetSnapshot(admin),
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
        net_assets:         balanceSheet?.netAssets ?? null,
        total_assets:       balanceSheet?.totalAssets ?? null,
        total_liabilities:  balanceSheet?.totalLiabilities ?? null,
      }, { onConflict: 'snapshot_month', ignoreDuplicates: true });

    if (insertError) return json({ error: insertError.message }, 500);

    return json({
      success: true,
      snapshot_month: snapshotMonth,
      compliance_pct: compliancePct,
      risk_pct:       riskPct,
      assets_pct:     assetsPct,
      goals_pct:      goalsPct,
      net_assets:         balanceSheet?.netAssets ?? null,
      total_assets:       balanceSheet?.totalAssets ?? null,
      total_liabilities:  balanceSheet?.totalLiabilities ?? null,
    });

  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
