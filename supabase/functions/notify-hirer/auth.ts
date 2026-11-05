// Shared-secret check for server-to-server calls (Phase 1, item 1).
// Kept inside each function folder (not _shared/) so the deployment
// registry and deploy-function.sh treat every function as self-contained.
//
// A caller is trusted if it presents one of THIS project's secret keys,
// either as `apikey: <key>` or `Authorization: Bearer <key>`:
//   1. the legacy service-role key (SUPABASE_SERVICE_ROLE_KEY, injected by Supabase), or
//   2. CHECK_DEADLINES_SECRET_KEY (project secret, already set for check-deadlines), or
//   3. any other sb_secret_ key of this project — confirmed by asking this
//      project's Auth admin API, which only answers secret/service keys.
// The public anon / publishable key is never accepted.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';

function configuredKeys(): string[] {
  return [
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    Deno.env.get('CHECK_DEADLINES_SECRET_KEY'),
  ].filter((k): k is string => !!k && k.length >= 20);
}

function timingSafeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  const len = Math.max(ea.length, eb.length);
  for (let i = 0; i < len; i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

const verifiedCache = new Set<string>();

export function extractKeys(req: Request): string[] {
  const keys: string[] = [];
  const apikey = req.headers.get('apikey');
  if (apikey) keys.push(apikey.trim());
  const auth = req.headers.get('authorization') ?? '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (m) keys.push(m[1].trim());
  return keys;
}

export async function isProjectSecretKey(presented: string | string[]): Promise<boolean> {
  const list = (Array.isArray(presented) ? presented : [presented]).filter(Boolean);
  for (const key of list) {
    if (configuredKeys().some((k) => timingSafeEqual(k, key))) return true;
    if (key.startsWith('sb_secret_')) {
      if (verifiedCache.has(key)) return true;
      try {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1`, {
          headers: { apikey: key },
        });
        await res.body?.cancel();
        if (res.ok) { verifiedCache.add(key); return true; }
      } catch (_) { /* treat as not verified */ }
    }
  }
  return false;
}
