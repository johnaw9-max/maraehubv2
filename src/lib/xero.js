import { supabase } from './supabase';

// Xero makes real external API calls with real rate limits, unlike most
// Supabase queries elsewhere in the app — cache in-session so repeated
// Board View / Finance tab loads don't hit Xero live every time. Resets on
// a hard page reload, which is an acceptable staleness bound for summary
// figures. Shared across callers so they don't each keep their own cache.
const XERO_CACHE_TTL_MS = 5 * 60 * 1000;
let xeroFinancialsCache = null; // { data, fetchedAt } | null

// Pass force=true to bypass the cache — used by manual "Refresh" actions,
// since a cached response defeats the point of an explicit user-initiated check.
export async function fetchXeroFinancials(force = false) {
  const now = Date.now();
  if (!force && xeroFinancialsCache && now - xeroFinancialsCache.fetchedAt < XERO_CACHE_TTL_MS) {
    return xeroFinancialsCache.data;
  }
  let result;
  try {
    const { data, error } = await supabase.functions.invoke('xero-financials');
    if (error) {
      result = { status: 'error' };
    } else {
      result = data?.connected ? { status: 'connected', ...data } : { status: 'not_connected' };
    }
  } catch {
    result = { status: 'error' };
  }
  xeroFinancialsCache = { data: result, fetchedAt: now };
  return result;
}

export function minsAgo(iso) {
  if (!iso) return null;
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return mins < 1 ? 'just now' : `${mins} min ago`;
}
