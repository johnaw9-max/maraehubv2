import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── HTML escaping ────────────────────────────────────────────────────────────
// meeting_actions.description is free text a trustee can type into via the
// app's normal UI — it must never be embedded in a page unescaped. & must be
// replaced first, or the entities the other replacements introduce would
// themselves get double-escaped.
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtDate(d: string): string {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-NZ', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

// ── Page wrapper ─────────────────────────────────────────────────────────────
// Content-Security-Policy blocks all script execution — this page needs no
// JS anywhere (plain HTML form, no fetch), so even a hypothetical escaping
// bug elsewhere couldn't achieve script execution. Doesn't restrict form
// submission — that's the separate form-action directive, left unset.
function page(title: string, bodyHtml: string): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 480px; margin: 60px auto; padding: 0 20px; color: #1a1a1a; }
  h1 { font-size: 1.25rem; }
  button { font-size: 1rem; padding: 10px 20px; background: #1a4d2e; color: white; border: none; border-radius: 6px; cursor: pointer; }
  .meta { color: #555; margin: 16px 0; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
    },
  });
}

const INVALID_PAGE = () => page('Invalid link', '<h1>This link isn’t valid.</h1>');
const ALREADY_DONE_PAGE = () => page('Already done', '<h1>This item has already been marked done.</h1>');
const EXPIRED_PAGE = () => page(
  'Link expired',
  '<h1>This link has expired.</h1><p class="meta">Please log in to MaraeHub to update this item.</p>',
);

serve(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get('token') ?? '';

  // Validate token shape before touching the database at all — a malformed
  // token should never reach Postgres and risk a raw type-cast error.
  if (!UUID_RE.test(token)) {
    return INVALID_PAGE();
  }

  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // ── GET — read-only. Never calls redeem_action_reminder_token. ────────────
  if (req.method === 'GET') {
    const { data } = await db
      .from('action_reminder_tokens')
      .select('used_at, expires_at, meeting_actions(description, due_date)')
      .eq('id', token)
      .maybeSingle();

    if (!data) {
      return INVALID_PAGE();
    }
    if (data.used_at) {
      return ALREADY_DONE_PAGE();
    }
    if (new Date(data.expires_at) < new Date()) {
      return EXPIRED_PAGE();
    }

    const action = data.meeting_actions as unknown as { description: string; due_date: string | null } | null;
    const description = escapeHtml(action?.description ?? 'this action');
    const dueDate = action?.due_date ? escapeHtml(fmtDate(action.due_date)) : null;
    const safeToken = escapeHtml(token);

    return page('Mark as done?', `
<h1>Mark "${description}" as done?</h1>
${dueDate ? `<p class="meta">Due: ${dueDate}</p>` : ''}
<form method="POST" action="?token=${safeToken}">
  <button type="submit">Mark as done</button>
</form>
`);
  }

  // ── POST — the only path that ever mutates anything. ──────────────────────
  if (req.method === 'POST') {
    const { data, error } = await db.rpc('redeem_action_reminder_token', { p_token: token });

    if (!error && data && data.length > 0) {
      const description = escapeHtml(data[0].description ?? 'this action');
      return page('Done', `<h1>Done — marked "${description}" as complete.</h1><p class="meta">Thanks!</p>`);
    }

    // Redemption failed: invalid, already used, or expired since the GET
    // was rendered. This follow-up read is for message quality only — it
    // never influences whether the mutation happened, that was already
    // fully and atomically decided by the RPC call above.
    const { data: lookup } = await db
      .from('action_reminder_tokens')
      .select('used_at, expires_at')
      .eq('id', token)
      .maybeSingle();

    if (lookup?.used_at) {
      return ALREADY_DONE_PAGE();
    }
    if (lookup && new Date(lookup.expires_at) < new Date()) {
      return EXPIRED_PAGE();
    }
    return page(
      'Link no longer valid',
      '<h1>This link is no longer valid.</h1><p class="meta">Please log in to MaraeHub to update this item.</p>',
    );
  }

  return new Response('Method not allowed', { status: 405 });
});
