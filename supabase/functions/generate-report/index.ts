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

// Moved verbatim from BoardDashboard.js's generateReport() -- the API key is
// the only thing that needed to move server-side, not the prompt wording.
const SYSTEM_PROMPT = `You are a governance advisor for a Māori community marae in Aotearoa New Zealand. Write clear, warm, and professional governance reports for marae trustees. Begin every report with "Tēnā koutou" on its own line. Use inclusive, community-focused language. Keep your tone respectful and solution-oriented. Structure the report with clear sections: an opening summary, what is performing well, what needs attention, and 3-5 specific recommendations in priority order. Use plain English — no jargon.`;

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
    // "any trustee can view already-synced numbers" precedent. ----
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
      max_tokens: 1500,
      thinking: { type: 'disabled' },
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Write a governance report for ${maraeName} based on the following board data. Cover what is performing well, what needs attention, and provide 3-5 specific recommendations in priority order.\n\n${context}`,
      }],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    const report = textBlock?.type === 'text' ? textBlock.text : '';

    return json({ report });

  } catch (err) {
    console.error('[generate-report] unexpected error:', (err as Error).message);
    return json({ error: (err as Error).message }, 500);
  }
});
