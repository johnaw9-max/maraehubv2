// "Recently deleted" for documents. Deleting sets deleted_at; the storage file stays until
// the document is permanently deleted (by a trustee, or automatically after the retention
// window the next time a trustee opens the Document Library).
import { storagePathFromRef } from './storageLinks';

export const TRASH_RETENTION_DAYS = 30;

export function daysLeft(deletedAt, now = Date.now()) {
  const expires = new Date(deletedAt).getTime() + TRASH_RETENTION_DAYS * 86400000;
  return Math.max(0, Math.ceil((expires - now) / 86400000));
}

export function isExpired(deletedAt, now = Date.now()) {
  return new Date(deletedAt).getTime() + TRASH_RETENTION_DAYS * 86400000 <= now;
}

// Removes the storage file (if it is one we host) and then the row.
// Storage first: if it fails the row stays, so the document remains restorable.
export async function permanentlyDelete(supabase, doc) {
  if (doc.file_url) {
    const ref = storagePathFromRef('documents', doc.file_url);
    if (ref.kind === 'path' && ref.path) {
      const { error } = await supabase.storage.from('documents').remove([ref.path]);
      if (error) return { ok: false, message: error.message };
    }
  }
  const { error } = await supabase.from('documents').delete().eq('id', doc.id);
  return error ? { ok: false, message: error.message } : { ok: true };
}

export async function purgeExpired(supabase, trashed, now = Date.now()) {
  let purged = 0;
  for (const doc of trashed) {
    if (isExpired(doc.deleted_at, now)) {
      const r = await permanentlyDelete(supabase, doc);
      if (r.ok) purged++;
    }
  }
  return purged;
}
