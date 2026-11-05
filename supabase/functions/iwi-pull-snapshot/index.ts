import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

// Iwi Hub (14yhc7knwwu) — iwi-pull-snapshot, deployed only to the separate
// Iwi Hub project (maraehub-iwi-hub-tainui, ref autzrcqblmxgiuibbvfa).
//
// Phase 1, item 3 (P1-03), approved by John Williams 5 Nov 2026:
// the temporary design accepted a marae project's URL and FULL service-role
// (administrator) key as request input. That key could end up in request
// logs, shell history or tooling, and gives total control of a marae's data.
// That input path has been REMOVED. This function now:
//   • never reads, uses or logs any marae key;
//   • refuses every pull with 410 Gone until the replacement exists.
//
// Replacement (to be proposed separately, Step 3): a narrow export function
// on each marae project that returns only compliance_pct / risk_pct /
// assets_pct / goals_pct to a caller holding a long random token stored as a
// hash, so the Iwi Hub never handles an administrator key. The previous
// read/upsert logic is in git history (commit 8420d9f) for reuse then.
//
// No marae app feature depends on this function. Iwi Hub has no users yet.
//
// Follow-up for John: replace (rotate) the service-role/secret key of any
// marae project whose key was ever pasted into a call to this function.

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-iwi-hub-key',
  };
}

serve((req) => {
  const cors = corsHeaders();
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  // Deliberately does not read the request body, so a key sent by an old
  // script is never parsed, used or logged.
  console.warn('[iwi-pull-snapshot] refused: function switched off (Phase 1, P1-03)');
  return new Response(
    JSON.stringify({
      error: 'iwi-pull-snapshot is switched off. Marae administrator keys are no longer accepted. ' +
             'Snapshot pulls resume when the token-gated export is built.',
    }),
    { status: 410, headers: { ...cors, 'Content-Type': 'application/json' } },
  );
});
