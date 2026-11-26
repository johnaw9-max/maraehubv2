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

const SYSTEM_PROMPT = `You help marae trustees understand their compliance items. Write for a busy trustee: plain words, short sentences, no jargon.

Answer ONLY from the RECORDS below. Do not use any other knowledge of the law. Never mention the words RECORDS or DATA.

Format, plain text only (no asterisks, no markdown, no bullets, no lists):
First line: what the records say, in one sentence. Do not begin with Yes or No, do not say whether it applies to the marae, and do not use words like likely or probably. Do not repeat numbers or facts from the question.
Then "What to do:" followed by one or two short sentences taken from the records.
Then, only if the records say who to ask, "Ask:" followed by the agency name only. Do not add "or a lawyer" when an agency is named.

Never write section numbers, regulation numbers, web links, dates or the names of Acts. The app shows the sources underneath.
Mention at most three items, and only items that answer the question. Refer to each by a short everyday name.
If the records do not answer the question, write only: "No source available in MaraeHub for this." and say who to ask, otherwise a lawyer.
Never say the marae complies or does not comply, and never decide whether something applies to it. The trustees decide.
Keep it under 70 words.

Last line, exactly: ITEMS: followed by the exact names of the items you used, copied exactly as written after "ITEM:" in the records, separated by " | ". If you used none, write ITEMS: none`;

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
      messages: [{ role: 'user', content: `QUESTION: ${question.trim()}\n\nRECORDS:\n${context}` }],
    });
    const textBlock = response.content.find((b) => b.type === 'text');
    const raw = textBlock?.type === 'text' ? textBlock.text : '';
    // Split the model's last "ITEMS:" line off: the app uses it to show the sources, never the model.
    const lines = raw.trim().split('\n');
    let items: string[] = [];
    const last = lines[lines.length - 1] ?? '';
    if (/^ITEMS:/i.test(last.trim())) {
      lines.pop();
      const list = last.trim().replace(/^ITEMS:\s*/i, '');
      items = list.toLowerCase() === 'none' ? [] : list.split(' | ').map((x) => x.trim()).filter(Boolean).slice(0, 3);
    }
    const answer = lines.join('\n').trim();

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

    return json({ answer, items });
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
