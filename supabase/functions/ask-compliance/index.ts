import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.121.0';

// "Ask" job: a trustee asks a question and gets an answer drawn ONLY from the marae's own compliance items and the sources
// recorded against them. Same guards as generate-compliance-report: trustee only, AI opt-in checked here, size cap, usage log.
const ALLOWED_ORIGINS = [Deno.env.get('FRONTEND_URL') ?? '', 'http://localhost:3000'].filter(Boolean);
const MAX_INPUT_CHARS = 60000;
const MAX_QUESTION_CHARS = 500;

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? '';
  const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : (Deno.env.get('FRONTEND_URL') ?? '');
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

const SYSTEM_PROMPT = `You answer questions from marae trustees in Aotearoa New Zealand about their compliance items. Use plain English and short sentences. Start with the answer.

Answer ONLY from the DATA below, which lists the marae's compliance items, how each is labelled (legal duty if it applies, good practice, or marae decision), what it requires, and its SOURCE. Do not use any other knowledge of the law.

If the DATA does not answer the question, say "No source available in MaraeHub for this." and suggest who to ask, naming the agency or source shown in the DATA where there is one, otherwise a lawyer. Never guess.

For every point you make, name the item and repeat its SOURCE exactly as given (name, section, link, date checked). Never add a law, section number, link or date that is not in the DATA. Say whether the item is a legal duty if it applies, good practice or a marae decision, exactly as the DATA labels it. Where the DATA says "no source found", say so plainly.

Never say the marae complies or does not comply, and never decide whether something applies to the marae. Say what the source says and that the trustees decide. If the question is not about the marae's compliance items, say you can only answer from them. Keep the answer under 150 words and end with one line: "Draft for the trustees to decide."`;

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
    const authHeader = req.headers.get('Authorization') ?? '';
    const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await callerClient.auth.getUser();
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);

    const { data: callerProfile } = await callerClient.from('profiles').select('role').eq('id', user.id).single();
    if (callerProfile?.role !== 'trustee') return json({ error: 'Trustee access required' }, 403);

    // Opt-in (D-09): checked where the data would leave. A missing column or any read error counts as off.
    const { data: aiSetting, error: aiSettingError } = await callerClient
      .from('marae_settings').select('ai_drafting_enabled').limit(1).maybeSingle();
    if (aiSettingError || aiSetting?.ai_drafting_enabled !== true) {
      return json({ error: 'AI features are not turned on for this marae. An administrator can turn them on in Marae Settings.' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const { question, context } = body;
    if (typeof question !== 'string' || !question.trim()) return json({ error: 'question is required' }, 400);
    if (question.length > MAX_QUESTION_CHARS) return json({ error: 'Please ask a shorter question.' }, 413);
    if (typeof context !== 'string' || !context.trim()) return json({ error: 'context is required' }, 400);
    if (context.length > MAX_INPUT_CHARS) return json({ error: 'That is too much information for one request.' }, 413);

    const anthropic = new Anthropic({ apiKey: anthropicKey });
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 700,
      thinking: { type: 'disabled' },
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `QUESTION: ${question.trim()}\n\nDATA:\n${context}` }],
    });
    const textBlock = response.content.find((b) => b.type === 'text');
    const answer = textBlock?.type === 'text' ? textBlock.text : '';

    // Usage record: sizes and counts only, never the question or the answer. A failure never blocks the trustee.
    try {
      const adminForLog = createClient(supabaseUrl, serviceKey);
      const { error: logError } = await adminForLog.from('ai_usage_log').insert({
        user_id: user.id,
        feature: 'ask-compliance',
        input_chars: context.length + question.length,
        input_tokens: response.usage?.input_tokens ?? null,
        output_tokens: response.usage?.output_tokens ?? null,
        status: 'ok',
      });
      if (logError) console.error('[ask-compliance] usage log insert failed:', logError.message);
    } catch (_e) {
      console.error('[ask-compliance] usage log insert failed');
    }

    return json({ answer });
  } catch (err) {
    const anthropicErr = err as { status?: number; message?: string };
    if (anthropicErr?.status === 401 || anthropicErr?.status === 403 ||
        (anthropicErr?.status === 400 && anthropicErr.message?.includes('credit balance'))) {
      console.error('[ask-compliance] Anthropic auth/billing error, status:', anthropicErr.status);
      return json({ error: 'ai_auth_or_billing' }, anthropicErr.status);
    }
    console.error('[ask-compliance] unexpected error, status:', anthropicErr?.status ?? 'none');
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
});
