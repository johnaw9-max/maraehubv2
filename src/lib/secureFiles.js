import React from 'react';
import { supabase } from './supabase';

/**
 * Phase 1, item 2 (P1-02) — Release 1: open stored files through short-lived
 * signed links.
 *
 * Today four buckets (documents, compliance-docs, finance-receipts,
 * emergency-response-evidence) are public, and records hold the full public
 * address, which never expires. This helper lets the app open a file from
 * EITHER an old public address OR a plain storage path, by asking Supabase
 * for a signed link when the user clicks.
 *
 * Release 1 is deliberately invisible: if a signed link cannot be made (for
 * example a bucket has no read policy yet), it falls back to the saved
 * address, exactly as before. Buckets stay public until D-04 Release 2.
 */

export const SIGNED_LINK_SECONDS = 3600; // 1 hour

/**
 * Returns the object path inside `bucket` for a saved value, or null if the
 * value is not a file in that bucket (e.g. an external web link).
 * Accepts: public URL, signed URL, or a bare path.
 */
export function storagePathFromValue(bucket, value) {
  if (!value || typeof value !== 'string') return null;
  if (!/^https?:\/\//i.test(value)) {
    return value.replace(/^\/+/, '');
  }
  let url;
  try { url = new URL(value); } catch { return null; }
  const markers = [
    `/storage/v1/object/public/${bucket}/`,
    `/storage/v1/object/sign/${bucket}/`,
    `/storage/v1/object/authenticated/${bucket}/`,
  ];
  for (const m of markers) {
    const i = url.pathname.indexOf(m);
    if (i !== -1) {
      try { return decodeURIComponent(url.pathname.slice(i + m.length)); } catch { return url.pathname.slice(i + m.length); }
    }
  }
  return null;
}

/** Signed link for a saved value; falls back to the value itself. */
export async function signedHref(bucket, value, seconds = SIGNED_LINK_SECONDS) {
  const path = storagePathFromValue(bucket, value);
  if (!path) return value || null;
  try {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, seconds);
    if (!error && data?.signedUrl) return data.signedUrl;
  } catch (_) { /* fall through */ }
  return /^https?:\/\//i.test(value) ? value : null;
}

/** Signed links for many values at once (same order). */
export async function signedHrefs(bucket, values, seconds = SIGNED_LINK_SECONDS) {
  return Promise.all((values || []).map(v => (v ? signedHref(bucket, v, seconds) : Promise.resolve(null))));
}

/**
 * Open a stored file in a new tab. The tab is opened synchronously (so pop-up
 * blockers allow it) and pointed at the signed link once it is ready.
 */
export async function openStoredFile(bucket, value) {
  const win = window.open('about:blank', '_blank');
  const href = await signedHref(bucket, value);
  if (!href) { if (win) win.close(); return; }
  if (win) {
    try { win.opener = null; } catch (_) { /* ignore */ }
    win.location.href = href;
  } else {
    window.location.assign(href);
  }
}

/** Remove a stored file given its saved value. Returns true if a removal was attempted. */
export async function removeStoredFile(bucket, value) {
  const path = storagePathFromValue(bucket, value);
  if (!path) return false;
  await supabase.storage.from(bucket).remove([path]);
  return true;
}

/**
 * Drop-in replacement for <a href={savedUrl} target="_blank">…</a>.
 * Keeps the same look; opens a signed link on click.
 */
export function StoredFileLink({ bucket, value, children, style, title, className, onClick }) {
  if (!value) return null;
  return React.createElement('a', {
    href: '#',
    role: 'link',
    style,
    title,
    className,
    onClick: (e) => {
      e.preventDefault();
      if (onClick) onClick(e);
      openStoredFile(bucket, value);
    },
  }, children);
}
