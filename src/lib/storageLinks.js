// Opening files from the private storage buckets.
//
// Old records saved a full public URL (…/storage/v1/object/public/<bucket>/<path>).
// Those buckets are private now, so that URL no longer opens. Newer records save only
// the path. This turns either into the path so a fresh signed link can be made at the
// moment of the click. A link to some other website (not our storage) is left alone.

export function storagePathFromRef(bucket, ref) {
  if (!ref) return { kind: 'none' };
  if (!/^https?:\/\//i.test(ref)) return { kind: 'path', path: ref };
  const m = ref.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/([^?#]+)/);
  if (!m) return { kind: 'external', url: ref };
  let path = m[2];
  try { path = decodeURIComponent(path); } catch (e) { /* keep as is */ }
  return { kind: 'path', bucket: m[1], path };
}

// Returns { ok: true } after opening, or { ok: false, message } for the screen to show.
export async function openStorageFile(supabase, bucket, ref, openWindow = (u) => window.open(u, '_blank', 'noopener,noreferrer')) {
  const r = storagePathFromRef(bucket, ref);
  if (r.kind === 'none') return { ok: false, message: 'There is no file attached.' };
  if (r.kind === 'external') { openWindow(r.url); return { ok: true }; }
  const { data, error } = await supabase.storage.from(r.bucket || bucket).createSignedUrl(r.path, 3600);
  if (error || !data?.signedUrl) {
    return { ok: false, message: 'Could not open this file. It may have been moved or removed. Please try again, or ask a trustee to upload it again.' };
  }
  openWindow(data.signedUrl);
  return { ok: true };
}
