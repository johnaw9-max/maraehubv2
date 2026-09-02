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

// AI Intelligence Layer roadmap (14yhc7knp9n), Report #4. Same shape as
// generate-report/generate-compliance-report/generate-financial-report
// throughout this file -- only the system prompt and the caller's context
// content differ.
//
// Real investigation done first (2026-09-02, both live projects): Opeke has
// 25 tasks, all open/in-progress -- not one has ever been marked completed
// or cancelled. Test project has 46, denser and more varied (open, in
// progress, completed, cancelled). No client-side zero-data gate, matching
// Report #2's reasoning: a skewed status distribution is itself the
// operational fact this report exists to surface, not a null case to hide.
const SYSTEM_PROMPT = `You are a governance advisor for a Māori community marae in Aotearoa New Zealand. Write clear, warm, and professional operational reports for marae trustees about tasks and meeting actions. Begin every report with "Tēnā koutou" on its own line. Use inclusive, community-focused language. Keep your tone respectful and solution-oriented.

Structure the report with four short sections covering: overdue tasks and actions, unassigned tasks and actions, workload concentration (who is carrying the most open items), and any stalled workflows. State the real numbers and names given to you plainly -- do not soften or hide a skewed distribution.

If the data tells you every task ever created at this marae is still open -- none ever marked completed or cancelled -- say so directly as a real, notable fact, not a minor detail. If that pattern is not present in the data, do not speculate about it or mention it.

Close with 3-5 specific, prioritized recommendations based only on what is actually in the data provided. Use plain English -- no jargon.`;

serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const json = (body: object, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  const supabaseUrl  = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey      = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY') ?? '';

  try {
    // ---- Auth: any trustee can generate a report -- task/action data isn't
    // admin-gated, same reasoning as every other report in this family. ----
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
      // 2000 -- four short factual sections plus a closing list, less
      // markdown overhead than Report #2's repeated per-category headers,
      // more content than #1/#3's single-flow prose. Starting point, not
      // proven -- verify with a real invocation and bump if it truncates,
      // same lesson as every prior report's max_tokens history.
      max_tokens: 2000,
      thinking: { type: 'disabled' },
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Write a tasks and actions report for ${maraeName} based on the following data.\n\n${context}`,
      }],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    const report = textBlock?.type === 'text' ? textBlock.text : '';

    return json({ report });

  } catch (err) {
    console.error('[generate-tasks-report] unexpected error:', (err as Error).message);
    return json({ error: (err as Error).message }, 500);
  }
});
