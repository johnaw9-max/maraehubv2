import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Access-Control-Allow-Origin can only ever be one literal value per response
// (never a list, never safe as '*' for authenticated requests) — so allow a
// small allowlist and echo back whichever one the actual request came from,
// rather than hardcoding a single production origin that breaks local testing.
const ALLOWED_ORIGINS = [Deno.env.get('FRONTEND_URL') ?? '', 'http://localhost:3000'].filter(Boolean);

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? '';
  const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : (Deno.env.get('FRONTEND_URL') ?? '');
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

const XERO_TOKEN_URL = 'https://identity.xero.com/connect/token';
const XERO_API_BASE  = 'https://api.xero.com/api.xro/2.0';

// Refresh proactively if the stored access_token is already expired or is
// about to be, rather than waiting for a 401 from Xero mid-request.
const REFRESH_BUFFER_MS = 2 * 60 * 1000;

// Xero's report JSON nests line items under recursive Rows[]; the totals we
// care about can appear as RowType "Row" or "SummaryRow" depending on the
// report — confirmed against two real responses: Profit & Loss's Net Profit,
// and Balance Sheet's Net Assets, both came back as "Row", not "SummaryRow"
// — so collect both, by label, at any nesting depth.
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

// A label being entirely absent is a legitimate zero — Xero omits whole
// sections when there's no activity in them, confirmed against a real
// empty-org response with no Income/Expenses sections at all. A label being
// present with a value that isn't a number is different: that's malformed
// data we don't understand, and this throws rather than silently showing $0.
function toAmount(context: string, value: string | undefined): number {
  const n = Number(value);
  if (Number.isNaN(n)) {
    throw new Error(`"${context}" had an unparseable value: ${JSON.stringify(value)}`);
  }
  return n;
}

// Matches BoardDashboard.js's NZ financial-year window (1 April - 31 March)
// exactly, so the Xero-connected and in-house paths mean the same thing for
// the same "Financial Health" label instead of silently differing in period.
function financialYearWindow(): { fromDate: string; toDate: string } {
  const now = new Date();
  const fyYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return {
    fromDate: `${fyYear}-04-01`,
    toDate: `${fyYear + 1}-03-31`,
  };
}

function parseProfitAndLoss(report: any) {
  const labeled = collectLabeledRows(report?.Rows);

  // The bottom line is always present regardless of activity level — if
  // it's missing, the report shape is genuinely unrecognized, not just empty.
  const netProfitLabel = ['Net Profit', 'Net Surplus', 'Net Deficit'].find((l) => l in labeled);
  if (!netProfitLabel) {
    throw new Error(
      `Could not locate a Net Profit/Surplus/Deficit row (found labels: ${Object.keys(labeled).join(', ') || 'none'})`,
    );
  }

  const expensesLabel = ['Total Expenses', 'Total Operating Expenses'].find((l) => l in labeled);

  return {
    totalIncome:   'Total Income' in labeled ? toAmount('Total Income', labeled['Total Income']) : 0,
    totalExpenses: expensesLabel ? toAmount(expensesLabel, labeled[expensesLabel]) : 0,
    netProfit:     toAmount(netProfitLabel, labeled[netProfitLabel]),
    reportDate: report?.ReportDate ?? null,
  };
}

function parseBankSummary(report: any) {
  const topRows = (report?.Rows as any[]) ?? [];
  const candidateRows = topRows.flatMap((r) => (r.RowType === 'Section' ? (r.Rows ?? []) : [r]));

  // "Total" is Xero's reserved aggregate row across all accounts, not an
  // account itself — confirmed against a real response where it appeared as
  // RowType "SummaryRow" with every balance cell blank. Excluding it by name
  // is what actually distinguishes it, since real accounts can apparently
  // use either RowType too.
  const accounts = candidateRows
    .filter((r: any) =>
      (r.RowType === 'Row' || r.RowType === 'SummaryRow') &&
      Array.isArray(r.Cells) && r.Cells.length >= 5 &&
      r.Cells[0]?.Value && r.Cells[0].Value !== 'Total',
    )
    .map((r: any) => ({
      name:            r.Cells[0].Value,
      openingBalance:  toAmount(`${r.Cells[0].Value} opening balance`, r.Cells[1]?.Value),
      cashReceived:    toAmount(`${r.Cells[0].Value} cash received`, r.Cells[2]?.Value),
      cashSpent:       toAmount(`${r.Cells[0].Value} cash spent`, r.Cells[3]?.Value),
      closingBalance:  toAmount(`${r.Cells[0].Value} closing balance`, r.Cells[4]?.Value),
    }));

  // Zero connected bank accounts is a legitimate state (confirmed against
  // the real Demo Company response), not a parse failure.
  return { accounts, reportDate: report?.ReportDate ?? null };
}

function parseBalanceSheet(report: any) {
  const labeled = collectLabeledRows(report?.Rows);

  // The bottom line is always present regardless of activity level — mirrors
  // Net Profit's role in the P&L parser above. Confirmed against a real
  // response: "Net Assets" appeared with the exact same label even when its
  // value was negative (-140.00) — unlike P&L, which needed a label fallback
  // across ['Net Profit', 'Net Surplus', 'Net Deficit'] because the literal
  // wording was assumed to vary by sign, Balance Sheet's real data shows the
  // label staying "Net Assets" regardless of sign, so no fallback list here.
  if (!('Net Assets' in labeled)) {
    throw new Error(
      `Could not locate a Net Assets row (found labels: ${Object.keys(labeled).join(', ') || 'none'})`,
    );
  }

  // ASSUMPTION, carried over from parseProfitAndLoss's "absent section = $0"
  // fix by analogy, NOT independently verified for Balance Sheet. The org
  // this was tested against had real, non-zero activity in every leaf
  // section (Bank, Current Assets, Current Liabilities, Equity) — a
  // genuinely empty category (e.g. a marae with zero bills) has never
  // actually been observed for this report. It's reasonable to expect Xero
  // behaves the same way here as it does for P&L (omitting a whole section
  // rather than reporting a $0 row when there's no activity in it), but if a
  // marae's Balance Sheet numbers look suspiciously/consistently zero where
  // real liabilities or assets are known to exist, check this assumption
  // first before trusting the number — it has not been proven against a real
  // zero-activity response the way the equivalent P&L fix was.
  return {
    totalAssets:      'Total Assets' in labeled      ? toAmount('Total Assets', labeled['Total Assets']) : 0,
    totalLiabilities: 'Total Liabilities' in labeled  ? toAmount('Total Liabilities', labeled['Total Liabilities']) : 0,
    netAssets:        toAmount('Net Assets', labeled['Net Assets']),
    totalEquity:      'Total Equity' in labeled       ? toAmount('Total Equity', labeled['Total Equity']) : 0,
    totalBank:        'Total Bank' in labeled         ? toAmount('Total Bank', labeled['Total Bank']) : 0,
    reportDate: report?.ReportDate ?? null,
  };
}

serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const json = (body: object, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  const supabaseUrl    = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const anonKey        = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const clientId       = Deno.env.get('XERO_CLIENT_ID') ?? '';
  const clientSecret   = Deno.env.get('XERO_CLIENT_SECRET') ?? '';

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  try {
    // ---- Auth: any trustee can view already-synced numbers, matching how
    // every other Board View panel works — only the connect/disconnect
    // action (xero-callback's Path A) stays admin-only, since that's the
    // one genuinely privileged action in this integration. ----
    const authHeader = req.headers.get('Authorization') ?? '';
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await callerClient.auth.getUser();
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);

    const { data: callerProfile } = await callerClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (callerProfile?.role !== 'trustee') {
      return json({ error: 'Trustee access required' }, 403);
    }

    // ---- Look up the active connection (service role — same pattern as xero-callback) ----
    const url = new URL(req.url);
    const entityId = url.searchParams.get('entity_id');

    let connQuery = adminClient
      .from('xero_connections')
      .select('id, tenant_id, tenant_name, access_token, refresh_token, access_token_expires_at')
      .eq('status', 'active');
    connQuery = entityId ? connQuery.eq('entity_id', entityId) : connQuery.is('entity_id', null);
    const { data: connection, error: connError } = await connQuery.maybeSingle();

    if (connError) return json({ error: connError.message }, 500);
    if (!connection) return json({ connected: false }, 200);

    // ---- Refresh the access token if it's expired or about to be ----
    let accessToken = connection.access_token;
    const expiresAt = new Date(connection.access_token_expires_at).getTime();

    if (Date.now() >= expiresAt - REFRESH_BUFFER_MS) {
      const refreshRes = await fetch(XERO_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: connection.refresh_token,
        }).toString(),
      });

      if (!refreshRes.ok) {
        console.error('[xero-financials] token refresh failed:', refreshRes.status);
        return json({ error: 'token_refresh_failed' }, 502);
      }

      const refreshed = await refreshRes.json();
      accessToken = refreshed.access_token;

      // Xero rotates the refresh_token on every use — the old one stops
      // working the moment this response lands, so persist both immediately.
      const { error: updateError } = await adminClient
        .from('xero_connections')
        .update({
          access_token: refreshed.access_token,
          refresh_token: refreshed.refresh_token,
          access_token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
          last_refreshed_at: new Date().toISOString(),
        })
        .eq('id', connection.id);

      if (updateError) {
        console.error('[xero-financials] failed to persist refreshed token:', updateError.message);
        return json({ error: 'token_persist_failed' }, 500);
      }
    }

    // ---- Fetch both reports in parallel ----
    const xeroHeaders = {
      'Authorization': `Bearer ${accessToken}`,
      'Xero-Tenant-Id': connection.tenant_id,
      'Accept': 'application/json',
    };

    // P&L and Bank Summary are period reports and default to the current
    // calendar month when no dates are given, confirmed 1 August 2026
    // against Xero's own ReportTitles ("1 August 2026 to 31 August 2026") -
    // silently different from the in-house fallback's financial-year window
    // for the same "Financial Health" label. Pinning both to the same NZ FY
    // window as BoardDashboard.js keeps the two paths meaning the same
    // thing. Balance Sheet is a point-in-time report ("as at" a date, not a
    // period) - today's default is already correct for it, left unchanged.
    const { fromDate, toDate } = financialYearWindow();
    const fyParams = new URLSearchParams({ fromDate, toDate }).toString();

    const [plRes, bsRes, balRes] = await Promise.all([
      fetch(`${XERO_API_BASE}/Reports/ProfitAndLoss?${fyParams}`, { headers: xeroHeaders }),
      fetch(`${XERO_API_BASE}/Reports/BankSummary?${fyParams}`, { headers: xeroHeaders }),
      fetch(`${XERO_API_BASE}/Reports/BalanceSheet`, { headers: xeroHeaders }),
    ]);

    if (!plRes.ok) {
      console.error('[xero-financials] Profit & Loss fetch failed:', plRes.status);
      return json({ error: 'profit_and_loss_fetch_failed' }, 502);
    }
    if (!bsRes.ok) {
      console.error('[xero-financials] Bank Summary fetch failed:', bsRes.status);
      return json({ error: 'bank_summary_fetch_failed' }, 502);
    }
    if (!balRes.ok) {
      console.error('[xero-financials] Balance Sheet fetch failed:', balRes.status);
      return json({ error: 'balance_sheet_fetch_failed' }, 502);
    }

    const plData  = await plRes.json();
    const bsData  = await bsRes.json();
    const balData = await balRes.json();

    const profitAndLoss = parseProfitAndLoss(plData?.Reports?.[0]);
    const bankSummary   = parseBankSummary(bsData?.Reports?.[0]);
    const balanceSheet  = parseBalanceSheet(balData?.Reports?.[0]);

    return json({
      connected: true,
      tenantName: connection.tenant_name,
      profitAndLoss,
      bankSummary,
      balanceSheet,
      lastSyncedAt: new Date().toISOString(),
    });

  } catch (err) {
    console.error('[xero-financials] unexpected error:', (err as Error).message);
    return json({ error: (err as Error).message }, 500);
  }
});
