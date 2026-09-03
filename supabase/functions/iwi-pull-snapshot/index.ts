import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Iwi Hub (14yhc7knwwu), Step 2 -- deployed to the Iwi Hub project itself
// (maraehub-iwi-hub-tainui, ref autzrcqblmxgiuibbvfa), not any marae project.
//
// Real, deliberate sequencing note: Step 3 (the secure, hashed-token
// marae_registry) doesn't exist yet, so this function temporarily accepts a
// target marae's URL + service_role_key as direct input parameters -- the
// same simplification already flagged in the original 1-hour proof, not a
// new one. Step 3 replaces this with a lookup against a real registry and a
// narrow, token-gated export function on the marae side, so a full
// service_role_key is never handled here again. This function's own logic
// (read module_kpi_snapshots, upsert into iwi_marae_snapshots) does not
// change when that happens -- only how the target credential is obtained
// does.
//
// Only ever pulls compliance_pct/risk_pct/assets_pct/goals_pct -- already
// pre-aggregated, safe summary data. Never touches raw operational tables.
//
// Real platform finding from verifying this on a brand-new project: for
// projects created after Supabase's newer API key rollout,
// Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') is populated with the new
// short-form sb_secret_... key, not the legacy JWT that older projects
// (the test project, Opeke) still use for the same env var. Any caller
// authenticating against THIS function needs the project's "secret"-type
// key from `supabase projects api-keys`, not the "service_role"-named
// legacy one -- confirmed by direct invocation, not assumed.

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-iwi-hub-key',
  };
}

serve(async (req) => {
  const cors = corsHeaders();
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const json = (body: object, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  const localSupabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const localServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  // Explicit, self-controlled secret for the caller-auth check below --
  // real platform finding: Supabase's own SUPABASE_SERVICE_ROLE_KEY value
  // returned by `supabase projects api-keys` did not match what was
  // actually injected into this brand-new project's function runtime
  // (same "sb_secret_" prefix, different length -- 119 vs 41 chars),
  // confirmed by direct debug invocation. Rather than depend on that
  // platform ambiguity, this function's own caller-auth uses a key we
  // generate and control directly, same principle as every other
  // credential in this project.
  const internalKey = Deno.env.get('IWI_HUB_INTERNAL_KEY') ?? '';

  try {
    // ---- Auth: internal admin tool only, no UI yet, no public/trustee JWT
    // flow -- Iwi Hub has no Auth set up until Step 5. Caller must present
    // this project's own service role key directly.
    //
    // Real platform finding: the Edge Functions gateway's `apikey` header
    // only accepts the publishable/anon-style key, never the new secret
    // key -- and sending both `apikey` and `Authorization` with different
    // key values gets rejected by the gateway itself as "conflicting",
    // before this code ever runs, regardless of verify_jwt. Confirmed by
    // direct invocation, not assumed. The real credential is passed in a
    // separate custom header the gateway does not inspect at all. ----
    const presentedKey = req.headers.get('X-Iwi-Hub-Key') ?? '';
    if (!internalKey || presentedKey !== internalKey) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const { marae_project_url, marae_service_role_key, marae_project_ref, marae_name } = body;

    if (typeof marae_project_url !== 'string' || !marae_project_url.trim()) {
      return json({ error: 'marae_project_url is required' }, 400);
    }
    if (typeof marae_service_role_key !== 'string' || !marae_service_role_key.trim()) {
      return json({ error: 'marae_service_role_key is required' }, 400);
    }
    if (typeof marae_project_ref !== 'string' || !marae_project_ref.trim()) {
      return json({ error: 'marae_project_ref is required' }, 400);
    }

    // ---- Read the target marae's latest KPI snapshot ----
    const targetClient = createClient(marae_project_url, marae_service_role_key);
    const { data: snapshot, error: readError } = await targetClient
      .from('module_kpi_snapshots')
      .select('snapshot_month, compliance_pct, risk_pct, assets_pct, goals_pct')
      .order('snapshot_month', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (readError) {
      console.error('[iwi-pull-snapshot] read from target marae failed:', readError.message);
      return json({ error: `Could not read snapshot from target marae: ${readError.message}` }, 502);
    }
    if (!snapshot) {
      return json({ error: 'Target marae has no KPI snapshot yet' }, 404);
    }

    // ---- Upsert into this project's own iwi_marae_snapshots ----
    const localClient = createClient(localSupabaseUrl, localServiceRoleKey);
    const row = {
      marae_project_ref,
      marae_name: marae_name || null,
      snapshot_month: snapshot.snapshot_month,
      compliance_pct: snapshot.compliance_pct,
      risk_pct: snapshot.risk_pct,
      assets_pct: snapshot.assets_pct,
      goals_pct: snapshot.goals_pct,
      pulled_at: new Date().toISOString(),
    };

    const { data: saved, error: writeError } = await localClient
      .from('iwi_marae_snapshots')
      .upsert(row, { onConflict: 'marae_project_ref,snapshot_month' })
      .select()
      .single();

    if (writeError) {
      console.error('[iwi-pull-snapshot] write failed:', writeError.message);
      return json({ error: writeError.message }, 500);
    }

    return json({ pulled: true, snapshot: saved });

  } catch (err) {
    console.error('[iwi-pull-snapshot] unexpected error:', (err as Error).message);
    return json({ error: (err as Error).message }, 500);
  }
});
