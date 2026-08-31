import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.121.0';

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

// AI Intelligence Layer roadmap (14yhc7knp9n), Report #2. Same shape as
// generate-report (Report #1) and generate-financial-report (Report #3)
// throughout this file -- only the system prompt and the caller's context
// content differ.
//
// Real investigation done before writing this (2026-08-30, both live
// projects): LIVE has 18 compliance_items, all in just 2 of 8 categories
// (the onboarding-wizard checklist), none ever assessed; risk_register is
// 0 rows; emergency_plan_hazards is migration-seeded, only 3 of 10 hazard
// types have any guidance text, and that text is generic regional
// civil-defence boilerplate, not written for this marae. Three design
// choices follow directly from that:
//
// 1. FACT -> RISK -> RECOMMENDATION structure, enforced per-section, not
//    just report-level -- sourced from the "All Blacks Principle" doc's
//    explicit requirement for this report.
// 2. No client-side zero-data gate (unlike Report #3's all-zero skip): "0
//    items outside the onboarding checklist, 0 risks registered" IS the
//    safety-relevant fact this report exists to surface, not a null case
//    to hide behind a static message.
// 3. Never assert legal compliance/non-compliance -- this is not legal
//    advice, and the sparse data gives no real basis for that kind of
//    conclusion anyway.
const SYSTEM_PROMPT = `You are a governance advisor for a Māori community marae in Aotearoa New Zealand. Write clear, warm, and professional compliance and safety reports for marae trustees. Begin every report with "Tēnā koutou" on its own line. Use inclusive, community-focused language. Keep your tone respectful and solution-oriented.

Structure every section as FACT, then RISK, then RECOMMENDATION — state what the data actually shows first, then what that may mean for the marae's safety or compliance position, then what to do about it. Never blur these three into one sentence.

You are not a lawyer and this is not legal advice. Never assert that the marae is, or is not, legally compliant with any specific law, regulation, or standard. State only what has or has not been recorded or assessed in the system, and describe risk in hedged, observational language ("this may indicate...", "worth confirming with...", "not yet assessed") rather than "non-compliant" or "in breach".

Some hazard-guidance data below may be shared boilerplate from a regional civil-defence template, not a marae-specific assessment written by this marae's trustees. Never treat guidance text as evidence of this marae's own emergency readiness. Only report how many of the defined hazard types have any guidance recorded at all, and treat the gap (hazard types with none) as the real, marae-specific fact worth flagging.

If a compliance category or the risk register has zero items recorded, state that plainly as a fact in its own right — do not treat it as "no data, skip this section" and do not soften it into "everything looks fine." An empty register is itself the safety-relevant finding. If the data available for a section is thin, say so honestly rather than overstating confidence.

Use plain English — no legal jargon, no assumed compliance expertise.`;

serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const json = (body: object, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  const supabaseUrl  = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey      = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY') ?? '';

  try {
    // ---- Auth: any trustee can generate a report, matching how every other
    // Board View panel works -- the report is built entirely from data a
    // trustee can already see on screen, same reasoning as xero-financials'
    // "any trustee can view already-synced numbers" precedent. Compliance
    // items and the risk register are not admin-gated in fetchAll() the way
    // finance is, so unlike Report #3 this has no extra role restriction
    // beyond trustee. ----
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

    // ---- Parse and validate the request body ----
    const body = await req.json().catch(() => ({}));
    const { maraeName, context } = body;
    if (typeof maraeName !== 'string' || !maraeName.trim()) {
      return json({ error: 'maraeName is required' }, 400);
    }
    if (typeof context !== 'string' || !context.trim()) {
      return json({ error: 'context is required' }, 400);
    }

    // ---- Call Claude ----
    // thinking explicitly disabled: claude-sonnet-5 runs adaptive thinking by
    // default when `thinking` is omitted, and thinking shares the same
    // max_tokens budget as the response text -- at max_tokens 1500 that could
    // silently truncate the report itself. This is a single non-streaming
    // call with no need for deep multi-step reasoning, so disabling thinking
    // keeps the full budget for the report.
    const anthropic = new Anthropic({ apiKey: anthropicKey });
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      // 4000. First bumped 1500 -> 2500 after a real Opeke invocation
      // (2026-08-31) truncated mid-sentence -- Report #2's per-section
      // FACT/RISK/RECOMMENDATION structure costs more tokens per visible
      // character than Reports #1/#3's single-flow prose. Then a second
      // real truncation, same day, on the test project: its genuinely
      // denser real data (26 compliance items across all 8 categories, 5
      // individually-listed risk register entries, vs. Opeke's 18 items in
      // 2 categories and 0 risks) still exhausted 2500 before finishing.
      // Unlike Reports #1/#3, this report's required length scales with how
      // much a marae has actually recorded, not just its structure -- so
      // the budget needs real headroom above the largest real dataset seen
      // so far, not just enough for today's numbers on either project.
      max_tokens: 4000,
      thinking: { type: 'disabled' },
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Write a compliance and safety report for ${maraeName} based on the following data. For each area — compliance items by category, the risk register, and emergency hazard-guidance coverage — use FACT, RISK, RECOMMENDATION structure. Close with 3-5 specific recommendations in priority order.\n\n${context}`,
      }],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    const report = textBlock?.type === 'text' ? textBlock.text : '';

    return json({ report });

  } catch (err) {
    console.error('[generate-compliance-report] unexpected error:', (err as Error).message);
    return json({ error: (err as Error).message }, 500);
  }
});
