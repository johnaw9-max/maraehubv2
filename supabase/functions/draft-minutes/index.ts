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

    const body = await req.json().catch(() => ({}));
    const { maraeName, roughNotes } = body;
    if (typeof maraeName !== 'string' || !maraeName.trim()) {
      return json({ error: 'maraeName is required' }, 400);
    }
    if (typeof roughNotes !== 'string' || !roughNotes.trim()) {
      return json({ error: 'roughNotes is required' }, 400);
    }

    const anthropic = new Anthropic({ apiKey: anthropicKey });
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      // 3000 -- rough notes + structured JSON output is smaller than the
      // free-prose compliance/financial reports. Flag and bump if a real
      // invocation truncates, same pattern as generate-compliance-report's
      // documented 1500 -> 2500 -> 4000 history.
      max_tokens: 3000,
      thinking: { type: 'disabled' },
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Marae: ${maraeName}\n\nRough hui notes:\n${roughNotes}`,
      }],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    const raw = textBlock?.type === 'text' ? textBlock.text : '';

    // Claude sometimes wraps JSON in a markdown code fence despite the system
    // prompt explicitly saying not to (confirmed via a real invocation on the
    // test project, 2026-09-02) -- strip a fence if present rather than
    // relying on prompt compliance alone.
    const unfenced = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();

    let draft;
    try {
      draft = JSON.parse(unfenced);
    } catch {
      console.error('[draft-minutes] AI response was not valid JSON:', raw);
      return json({ error: 'The AI response could not be read as a draft. Please try again.' }, 500);
    }

    if (typeof draft.minutes !== 'string' || !Array.isArray(draft.resolutions) || !Array.isArray(draft.actions)) {
      console.error('[draft-minutes] AI response had the wrong shape:', draft);
      return json({ error: 'The AI response was not in the expected format. Please try again.' }, 500);
    }

    return json({ draft });

  } catch (err) {
    console.error('[draft-minutes] unexpected error:', (err as Error).message);
    return json({ error: (err as Error).message }, 500);
  }
});
