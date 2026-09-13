import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.121.0';

const ALLOWED_ORIGINS = [Deno.env.get('FRONTEND_URL') ?? '', 'http://localhost:3000'].filter(Boolean);

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? '';
  const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : (Deno.env.get('FRONTEND_URL') ?? '');
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

// Future Integrations roadmap (14yhc7kpjbd), Step 7 -- 5th sibling in the
// generate-report/generate-compliance-report/generate-financial-report/
// generate-tasks-report family. Same shape throughout this file; only the
// system prompt, the caller's context content, and the audience differ --
// this is the first report in the family addressed to an external funder,
// not to the marae's own trustees.
//
// Real investigation done first (Step 6, 13 Sept 2026, both live projects):
// Opeke (real production) has 0 grants and 0 goals -- nothing exists yet to
// draft an application from. Tineka (test) has 3 grants with funder/amount/
// deadline but empty `notes` on all three and no contact info; its 3 goals
// are all seed data (`DEMO - ...`), including the one that matches a grant,
// via a Tier-1 self-tag only, not real descriptive content. No marae in the
// system has the full real evidence chain (grant + confirmed goal + stated
// need + supporting finance/asset numbers) yet -- this prompt is written to
// produce an honest, gap-flagged draft from whatever partial chain a
// trustee actually has, not to assume a complete one.
const SYSTEM_PROMPT = `You are drafting a grant application first draft on behalf of the trustees of a Māori community marae in Aotearoa New Zealand. The audience is the funder named in the data below -- not the marae's own trustees -- so write as a formal application letter, not an internal governance report. Use inclusive, respectful, plain English. No jargon.

Structure the draft in this order: (1) who we are -- marae name and location only, from the data given; (2) the ask -- which grant, from which funder, for what amount, by what deadline; (3) the need -- described only using the goal's own recorded name, description and notes; do not paraphrase this into something more compelling than what was actually written; (4) supporting information -- state only the real financial or asset figures given, and only as plain facts, never as a conclusion about affordability or need; (5) a closing paragraph.

Hard rules, no exceptions:
- Never invent a number, date, name, amount, or fact that is not literally present in the data provided. If you are tempted to add a plausible-sounding detail (a budget breakdown, a past project, an outcome, a legal or charity registration number, bank details, a track record), stop and instead insert a literal bracketed placeholder such as [INSERT: itemised budget breakdown] or [INSERT: charity registration number] for a trustee to fill in.
- Never state or imply that the marae is legally compliant, registered, or in good standing with any authority unless that exact fact is given to you in the data.
- Never conclude that the marae can or cannot afford this project, or that it does or does not need the funding, beyond restating whatever real figures are given. Judging financial capacity or need is a separate, deliberately human decision this draft must not make.
- If the data given to you is thin or a whole section (need, financials, assets, contact details) has nothing real to draw on, say so plainly with a bracketed placeholder for that section rather than writing generic filler prose to make the draft read as more complete than it is.
- End every draft with this exact line on its own: "This is an AI-generated first draft. Every fact above must be checked, and every placeholder filled in, by a trustee before this is submitted."`;

serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const json = (body: object, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  const supabaseUrl  = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey      = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY') ?? '';

  try {
    // ---- Auth: any trustee can generate a draft -- grants aren't admin-gated
    // in GrantsTracker.js, same reasoning as every other report in this
    // family. The draft is built entirely from data a trustee can already
    // see, plus a goal they have explicitly confirmed the application is
    // for (enforced client-side, per Step 6 design -- an unconfirmed
    // Tier-3/4 keyword match must not be drafted from as if it were
    // authoritative). ----
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

    const body = await req.json().catch(() => ({}));
    const { maraeName, context } = body;
    if (typeof maraeName !== 'string' || !maraeName.trim()) {
      return json({ error: 'maraeName is required' }, 400);
    }
    if (typeof context !== 'string' || !context.trim()) {
      return json({ error: 'context is required' }, 400);
    }

    const anthropic = new Anthropic({ apiKey: anthropicKey });
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      // 3000 -- starting point, not proven, same honest caveat as every
      // prior report's max_tokens history: a five-section letter plus
      // bracketed placeholders for whatever's missing sits between Report
      // #1's single-flow prose (1500) and Report #2's per-category
      // FACT/RISK/RECOMMENDATION structure (4000). Verify with a real
      // invocation on both projects and bump if it truncates.
      max_tokens: 3000,
      thinking: { type: 'disabled' },
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Draft a grant application first draft for ${maraeName} based on the following data. Follow the five-section structure exactly. Use a bracketed placeholder for anything the data does not actually give you.\n\n${context}`,
      }],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    const draft = textBlock?.type === 'text' ? textBlock.text : '';

    return json({ draft });

  } catch (err) {
    console.error('[generate-grant-draft] unexpected error:', (err as Error).message);
    return json({ error: (err as Error).message }, 500);
  }
});
