import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.121.0';

const ALLOWED_ORIGINS = [Deno.env.get('FRONTEND_URL') ?? '', 'http://localhost:3000'].filter(Boolean);

// Largest amount of text one AI request may send (characters).
const MAX_INPUT_CHARS = 60000;
// Drafts each marae may make per calendar month (UTC) unless marae_settings.ai_monthly_limit says otherwise.
const DEFAULT_MONTHLY_LIMIT = 30;

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? '';
  const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : (Deno.env.get('FRONTEND_URL') ?? '');
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

// Text-based AI Minutes draft (86d44q123 follow-up, 14yhc7knux1) -- a trustee
// pastes rough hui notes, this structures them into a draft minutes summary
// plus suggested resolutions/actions. Same shape as generate-compliance-report
// throughout this file. This produces a DRAFT only -- the frontend never
// writes anything to meetings/resolutions/meeting_actions directly from this
// response; every suggestion is reviewed through the app's existing,
// already-trusted add-resolution/add-action forms before it can be saved.
const SYSTEM_PROMPT = `You are a meeting-minutes assistant for a Māori community marae trustee board in Aotearoa New Zealand. A trustee will give you rough, informal notes taken during or after a hui. Turn them into a clear, professional draft minutes summary, plus any resolutions and action items that are clearly present in the notes.

This is a DRAFT for a human trustee to review, edit, and approve before anything is saved as the official record. Never present anything as final or already decided.

Critical rules:
- Only extract a resolution if the notes clearly describe the board actually deciding or agreeing on something. Do not invent decisions that were not stated.
- Only extract an action item if the notes clearly describe someone being asked to do something. Only set "assigned_to" or "due_date" if a name or date is explicitly stated in the notes -- if not stated, use null. Never guess a name or date.
- Never invent attendee names, figures, or details that are not in the notes.
- If the notes are too sparse to produce a meaningful minutes summary, say so honestly in the "minutes" field rather than padding it out.

Respond with ONLY valid JSON, no markdown code fences, no extra commentary before or after it, in exactly this shape:
{
  "minutes": "the structured minutes summary as plain text",
  "resolutions": [{ "description": "..." }],
  "actions": [{ "description": "...", "assigned_to": "name or null", "due_date": "YYYY-MM-DD or null" }]
}`;

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

    const body = await req.json().catch(() => ({}));
    const { maraeName, roughNotes } = body;
    if (typeof maraeName !== 'string' || !maraeName.trim()) {
      return json({ error: 'maraeName is required' }, 400);
    }
    if (typeof roughNotes !== 'string' || !roughNotes.trim()) {
      return json({ error: 'roughNotes is required' }, 400);
    }

    // Size limit on what can be sent to the AI (spec v0.2 section 8, risk R2/R6).
    if (roughNotes.length > MAX_INPUT_CHARS) {
      return json({ error: 'That is too much information for one request. Please use a shorter section.' }, 413);
    }

    // Per-marae monthly limit (spec v0.2 section 8, risk R6). Counts drafts already made this
    // month. If the limit or the count cannot be read, the request is NOT blocked.
    const admin = createClient(supabaseUrl, serviceKey);
    let monthlyLimit = DEFAULT_MONTHLY_LIMIT;
    const { data: limitRow } = await admin.from('marae_settings').select('ai_monthly_limit').limit(1).maybeSingle();
    if (typeof limitRow?.ai_monthly_limit === 'number') monthlyLimit = limitRow.ai_monthly_limit;
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const { count: usedThisMonth, error: countError } = await admin
      .from('ai_usage_log')
      .select('id', { count: 'exact', head: true })
      .eq('feature', 'draft-minutes')
      .in('status', ['ok', 'unreadable'])
      .gte('created_at', monthStart.toISOString());
    if (!countError && (usedThisMonth ?? 0) >= monthlyLimit) {
      return json({ error: 'This marae has used its AI drafts for this month. You can still write the minutes by hand.' }, 429);
    }

    const anthropic = new Anthropic({ apiKey: anthropicKey });
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      // 6000 -- doubled from 3000 so a long hui is not cut off (spec v0.2 section 8, risk R6).
      max_tokens: 6000,
      thinking: { type: 'disabled' },
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Marae: ${maraeName}\n\nRough hui notes:\n${roughNotes}`,
      }],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    const raw = textBlock?.type === 'text' ? textBlock.text : '';

    const recordUnreadable = async () => {
      try {
        await admin.from('ai_usage_log').insert({
          user_id: user.id, feature: 'draft-minutes', input_chars: roughNotes.length,
          input_tokens: response.usage?.input_tokens ?? null, output_tokens: response.usage?.output_tokens ?? null,
          status: 'unreadable',
        });
      } catch (_e) { /* never blocks the request */ }
    };


    // Claude sometimes wraps JSON in a markdown code fence despite the system
    // prompt explicitly saying not to (confirmed via a real invocation on the
    // test project, 2026-09-02) -- strip a fence if present rather than
    // relying on prompt compliance alone.
    const unfenced = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();

    let draft;
    try {
      draft = JSON.parse(unfenced);
    } catch {
      // Size only: the AI reply is built from the trustee's notes, so it must never reach server logs.
      console.error('[draft-minutes] AI response was not valid JSON, length:', raw.length, 'stop_reason:', response.stop_reason);
      await recordUnreadable();
      return json({ error: 'The AI response could not be read as a draft. Please try again.' }, 500);
    }

    if (typeof draft.minutes !== 'string' || !Array.isArray(draft.resolutions) || !Array.isArray(draft.actions)) {
      console.error('[draft-minutes] AI response had the wrong shape, length:', raw.length);
      await recordUnreadable();
      return json({ error: 'The AI response was not in the expected format. Please try again.' }, 500);
    }

    try {
      const { error: logError } = await admin.from('ai_usage_log').insert({
        user_id: user.id, feature: 'draft-minutes', input_chars: roughNotes.length,
        input_tokens: response.usage?.input_tokens ?? null, output_tokens: response.usage?.output_tokens ?? null,
        status: 'ok',
      });
      if (logError) console.error('[draft-minutes] usage log insert failed:', logError.message);
    } catch (_e) { /* never blocks the request */ }

    return json({ draft });

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
      console.error('[draft-minutes] Anthropic auth/billing error, status:', anthropicErr.status);
      return json({ error: 'ai_auth_or_billing' }, anthropicErr.status);
    }
    // Log the error status only; the error text could echo request content.
    console.error('[draft-minutes] unexpected error, status:', anthropicErr?.status ?? 'none');
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
});
