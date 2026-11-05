// Shared-secret check for server-to-server calls (Phase 1, item 1).
// Kept inside each function folder (not _shared/) so the deployment
// registry and deploy-function.sh treat every function as self-contained.
//
// A caller is trusted if it presents one of THIS project's secret keys,
// either as `apikey: <key>` or `Authorization: Bearer <key>`:
//   1. the legacy service-role key (SUPABASE_SERVICE_ROLE_KEY, injected by Supabase), or
//   2. CHECK_DEADLINES_SECRET_KEY (project secret, already set for check-deadlines), or
//   3. any other sb_secret_ key, or legacy JWT whose role claim is
//      service_role, of this project — confirmed by asking this project's
//      Auth admin API, which only answers genuine secret/service keys.
//      (Live test 5 Nov 2026: the vault copy of the service key differs from
//      the copy injected into functions, so exact matching alone is not enough.)
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

/** Role claim of a JWT-shaped key, without trusting it (the Auth probe decides). */
function jwtRole(key: string): string | null {
  const parts = key.split('.');
  if (parts.length !== 3) return null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)));
    return typeof payload?.role === 'string' ? payload.role : null;
  } catch { return null; }
}

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
    if (key.startsWith('sb_secret_') || jwtRole(key) === 'service_role') {
      if (verifiedCache.has(key)) return true;
      try {
        // sb_secret_ keys go on apikey only (the gateway maps them); legacy JWT
        // keys must also be the bearer token, or Auth rejects the admin call.
        const headers: Record<string, string> = key.startsWith('sb_secret_')
          ? { apikey: key }
          : { apikey: key, Authorization: `Bearer ${key}` };
        const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1`, { headers });
        await res.body?.cancel();
        if (res.ok) { verifiedCache.add(key); return true; }
      } catch (_) { /* treat as not verified */ }
    }
  }
  return false;
}
