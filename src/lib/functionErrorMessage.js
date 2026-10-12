// supabase-js's error.message on a non-2xx Edge Function response is
// always the generic "Edge Function returned a non-2xx status code" --
// the function's real, specific message (e.g. "already registered")
// lives in the response body instead, at error.context (confirmed
// 2026-09-24 investigating a real Add Trustee report that turned out
// to be this exact swallowing, not a backend/deployment problem).
export async function functionErrorMessage(error, fallback) {
  if (error?.context && typeof error.context.json === 'function') {
    try {
      const body = await error.context.clone().json();
      if (body?.error) return body.error;
    } catch { /* response wasn't JSON */ }
  }
  return error?.message || fallback;
}
