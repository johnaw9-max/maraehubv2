import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.121.0';

const ALLOWED_ORIGINS = [Deno.env.get('FRONTEND_URL') ?? '', 'http://localhost:3000'].filter(Boolean);

// Largest amount of text one AI request may send (characters).
const MAX_INPUT_CHARS = 60000;

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
  const serviceKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
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

    // D-09 (opt-in): AI features run only when this marae's admin has turned them on.
    // Enforced here, where the data would leave, not just in the app. A missing
    // column or any read error counts as off.
    const { data: aiSetting, error: aiSettingError } = await callerClient
      .from('marae_settings')
      .select('ai_drafting_enabled')
      .limit(1)
      .maybeSingle();
    if (aiSettingError || aiSetting?.ai_drafting_enabled !== true) {
      return json({ error: 'AI features are not turned on for this marae. An administrator can turn them on in Marae Settings.' }, 403);
    }

    // D-09 (opt-in): AI features run only when this marae's admin has turned them on.
    // Enforced here, where the data would leave, not just in the app. A missing
    // column or any read error counts as off.
    const { data: aiSetting, error: aiSettingError } = await callerClient
      .from('marae_settings')
      .select('ai_drafting_enabled')
      .limit(1)
      .maybeSingle();
    if (aiSettingError || aiSetting?.ai_drafting_enabled !== true) {
      return json({ error: 'AI features are not turned on for this marae. An administrator can turn them on in Marae Settings.' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const { maraeName, context } = body;
    if (typeof maraeName !== 'string' || !maraeName.trim()) {
      return json({ error: 'maraeName is required' }, 400);
    }
    if (typeof context !== 'string' || !context.trim()) {
      return json({ error: 'context is required' }, 400);
    }

    // Size limit on what can be sent to the AI (spec v0.2 section 8, risk R2/R6).
    if (context.length > MAX_INPUT_CHARS) {
      return json({ error: 'That is too much information for one request. Please use a shorter section.' }, 413);
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


    // AI usage record: sizes and counts only, never notes or AI text (spec v0.2 section 8, risk R6).
    // A failure to record never blocks the trustee's request.
    try {
      const adminForLog = createClient(supabaseUrl, serviceKey);
      const { error: logError } = await adminForLog.from('ai_usage_log').insert({
        user_id: user.id,
        feature: 'generate-tasks-report',
        input_chars: context.length,
        input_tokens: response.usage?.input_tokens ?? null,
        output_tokens: response.usage?.output_tokens ?? null,
        status: 'ok',
      });
      if (logError) console.error('[generate-tasks-report] usage log insert failed:', logError.message);
    } catch (_e) {
      console.error('[generate-tasks-report] usage log insert failed');
    }

    return json({ report });

  } catch (err) {
    // Anthropic APIError exposes a numeric .status -- 401 (invalid/revoked
    // key), 403 (permission denied), or a 400 whose message mentions
    // "credit balance" (Anthropic's wording for insufficient funds) are
    // the auth/billing cases the frontend shows a clean message for
    // instead of this generic shape (14yhc7kw74b).
    const anthropicErr = err as { status?: number; message?: string };
    if (
      anthropicErr?.status === 401 ||
      anthropicErr?.status === 403 ||
      (anthropicErr?.status === 400 && anthropicErr.message?.includes('credit balance'))
    ) {
      console.error('[generate-tasks-report] Anthropic auth/billing error, status:', anthropicErr.status);
      return json({ error: 'ai_auth_or_billing' }, anthropicErr.status);
    }
    // Log the error status only; the error text could echo request content.
    console.error('[generate-tasks-report] unexpected error, status:', anthropicErr?.status ?? 'none');
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
});
