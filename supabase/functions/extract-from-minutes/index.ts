import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.121.0';

const ALLOWED_ORIGINS = [Deno.env.get('FRONTEND_URL') ?? '', 'http://localhost:3000'].filter(Boolean);

const MAX_INPUT_CHARS = 60000;
const DEFAULT_MONTHLY_LIMIT = 30;
const MAX_SUGGESTIONS = 40;
const FEATURE = 'extract-from-minutes';

const RISK_CATEGORIES = ['Health & Safety', 'Financial', 'Governance', 'Environmental', 'Reputational'];
const LEVELS = ['Low', 'Medium', 'High'];
const ASSET_CATEGORIES = ['Building', 'Equipment', 'Vehicle', 'Technology', 'Grounds', 'Inventory', 'Other'];
const GRANT_CATEGORIES = ['Community', 'Cultural', 'Education', 'Environment', 'Health', 'Infrastructure', 'Sport & Recreation', 'Other'];

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? '';
  const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : (Deno.env.get('FRONTEND_URL') ?? '');
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

// Reads the APPROVED minutes of one hui and SUGGESTS items for the trustees to tick.
// Nothing is saved here. The app saves only what a named trustee ticks, through the same
// routines the normal screens use. Every suggestion must carry a quote copied from the
// minutes; any suggestion whose quote is not really in the minutes is dropped below.
const SYSTEM_PROMPT = `You read the approved minutes of one hui of a Māori marae trustee board in Aotearoa New Zealand and suggest items a trustee may want to add to the marae's records. A trustee will review every suggestion and tick the ones to keep, so be accurate and plain, not exhaustive.

Suggest only these kinds:
- "task": a job someone was asked to do. Fields: description, assigned_to (a name only if the minutes state it, else null), due_date (YYYY-MM-DD only if a date is stated, else null).
- "risk": a problem or exposure the minutes describe that could hurt the marae. Fields: description (one plain sentence), category (one of ${RISK_CATEGORIES.join(', ')}), likelihood and consequence (each one of Low, Medium, High: your honest estimate from what the minutes say), controls (what the minutes say is already being done, else null), owner (a name only if stated, else null).
- "asset": a physical thing the marae owns, is buying, or needs, that the minutes describe. Fields: name, category (one of ${ASSET_CATEGORIES.join(', ')}), notes (what the minutes say about it, else null).
- "grant": funding the marae is looking at, applying for, or reporting on. Fields: funder, name (the grant or fund, else the funder name), amount (a number only if stated, else null), category (one of ${GRANT_CATEGORIES.join(', ')}), deadline (YYYY-MM-DD only if stated, else null), notes (else null).
- "decision": something the board clearly decided or agreed. Fields: description.

Critical rules:
- Every suggestion MUST have a "quote": the exact words copied from the minutes that support it, at most 250 characters, copied character for character. Do not paraphrase the quote.
- Use only what the minutes say. Never invent names, dates, amounts, or details. If something is not stated, use null.
- Do not suggest compliance duties, legal requirements, or verified anything. Do not suggest money entries, bank balances, or changes to who has access. Leave those out.
- Do not suggest the same thing twice. If the minutes are thin, suggest less. An empty list is a good answer.
- Do not include whānau, tangi, or personal sensitive details in descriptions beyond what a task or risk needs.

Respond with ONLY valid JSON, no markdown fences, no commentary, in exactly this shape:
{ "suggestions": [ { "kind": "task|risk|asset|grant|decision", "quote": "...", ...the fields for that kind } ] }`;

function norm(s: string) {
  return s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim().toLowerCase();
}

const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const pick = (v: unknown, list: string[], fallback: string) => (typeof v === 'string' && list.includes(v) ? v : fallback);
const isoDate = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v)) ? v : null);

// Keeps only well-formed suggestions whose quote really appears in the minutes.
export function cleanSuggestions(raw: unknown, minutes: string) {
  if (!Array.isArray(raw)) return [];
  const source = norm(minutes);
  const out: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  for (const s of raw) {
    if (out.length >= MAX_SUGGESTIONS) break;
    if (!s || typeof s !== 'object') continue;
    const item = s as Record<string, unknown>;
    const quote = str(item.quote, 250);
    if (!quote || !source.includes(norm(quote))) continue;
    let clean: Record<string, unknown> | null = null;
    switch (item.kind) {
      case 'task': {
        const description = str(item.description, 300);
        if (description) clean = { kind: 'task', description, assigned_to: str(item.assigned_to, 80), due_date: isoDate(item.due_date) };
        break;
      }
      case 'risk': {
        const description = str(item.description, 400);
        if (description) clean = {
          kind: 'risk', description,
          category: pick(item.category, RISK_CATEGORIES, 'Governance'),
          likelihood: pick(item.likelihood, LEVELS, 'Medium'),
          consequence: pick(item.consequence, LEVELS, 'Medium'),
          controls: str(item.controls, 400), owner: str(item.owner, 80),
        };
        break;
      }
      case 'asset': {
        const name = str(item.name, 120);
        if (name) clean = { kind: 'asset', name, category: pick(item.category, ASSET_CATEGORIES, 'Other'), notes: str(item.notes, 300) };
        break;
      }
      case 'grant': {
        const funder = str(item.funder, 120);
        if (funder) clean = {
          kind: 'grant', funder, name: str(item.name, 120) ?? funder,
          amount: typeof item.amount === 'number' && isFinite(item.amount) && item.amount >= 0 ? item.amount : null,
          category: pick(item.category, GRANT_CATEGORIES, 'Community'),
          deadline: isoDate(item.deadline), notes: str(item.notes, 300),
        };
        break;
      }
      case 'decision': {
        const description = str(item.description, 400);
        if (description) clean = { kind: 'decision', description };
        break;
      }
    }
    if (!clean) continue;
    const key = `${clean.kind}:${norm(String(clean.description ?? clean.name ?? clean.funder))}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...clean, quote });
  }
  return out;
}

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

    // Opt-in, enforced where the data would leave: the marae's administrator must have turned AI on.
    const { data: aiSetting, error: aiSettingError } = await callerClient
      .from('marae_settings').select('ai_drafting_enabled').limit(1).maybeSingle();
    if (aiSettingError || aiSetting?.ai_drafting_enabled !== true) {
      return json({ error: 'AI features are not turned on for this marae. An administrator can turn them on in Marae Settings.' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const { maraeName, minutes } = body;
    if (typeof maraeName !== 'string' || !maraeName.trim()) return json({ error: 'maraeName is required' }, 400);
    if (typeof minutes !== 'string' || !minutes.trim()) return json({ error: 'minutes is required' }, 400);
    if (minutes.length > MAX_INPUT_CHARS) {
      return json({ error: 'These minutes are too long for one request. Please use a shorter section.' }, 413);
    }

    const admin = createClient(supabaseUrl, serviceKey);
    let monthlyLimit = DEFAULT_MONTHLY_LIMIT;
    const { data: limitRow } = await admin.from('marae_settings').select('ai_monthly_limit').limit(1).maybeSingle();
    if (typeof limitRow?.ai_monthly_limit === 'number') monthlyLimit = limitRow.ai_monthly_limit;
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const { count: usedThisMonth, error: countError } = await admin
      .from('ai_usage_log').select('id', { count: 'exact', head: true })
      .eq('feature', FEATURE).in('status', ['ok', 'unreadable'])
      .gte('created_at', monthStart.toISOString());
    if (!countError && (usedThisMonth ?? 0) >= monthlyLimit) {
      return json({ error: 'This marae has used its AI reads for this month. You can still add items by hand.' }, 429);
    }

    const log = async (status: string, usage?: { input_tokens?: number; output_tokens?: number }) => {
      try {
        await admin.from('ai_usage_log').insert({
          user_id: user.id, feature: FEATURE, input_chars: minutes.length,
          input_tokens: usage?.input_tokens ?? null, output_tokens: usage?.output_tokens ?? null, status,
        });
      } catch (_e) { /* never blocks the request */ }
    };

    const anthropic = new Anthropic({ apiKey: anthropicKey });
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 6000,
      thinking: { type: 'disabled' },
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Marae: ${maraeName}\n\nApproved minutes:\n${minutes}` }],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    const raw = textBlock?.type === 'text' ? textBlock.text : '';
    const unfenced = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(unfenced);
    } catch {
      // Size only: the reply is built from the minutes, so it must never reach server logs.
      console.error('[extract-from-minutes] AI response was not valid JSON, length:', raw.length, 'stop_reason:', response.stop_reason);
      await log('unreadable', response.usage);
      return json({ error: 'The AI response could not be read. Please try again.' }, 500);
    }

    const suggestions = cleanSuggestions(parsed?.suggestions, minutes);
    await log('ok', response.usage);
    return json({ suggestions });

  } catch (err) {
    const anthropicErr = err as { status?: number; message?: string };
    if (
      anthropicErr?.status === 401 || anthropicErr?.status === 403 ||
      (anthropicErr?.status === 400 && anthropicErr.message?.includes('credit balance'))
    ) {
      console.error('[extract-from-minutes] Anthropic auth/billing error, status:', anthropicErr.status);
      return json({ error: 'ai_auth_or_billing' }, anthropicErr.status);
    }
    console.error('[extract-from-minutes] unexpected error, status:', anthropicErr?.status ?? 'none');
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
});
