// Which register sources back a compliance item, and how that is described to a trustee.
// Pure functions (no React, no network). The sources live in the legal_sources table;
// an item points to them with source_keys. Nothing here claims more than the source row says.

// key -> source row
export function indexSources(rows) {
  const map = {};
  for (const r of rows || []) if (r && r.key) map[r.key] = r;
  return map;
}

// The source rows for an item, in the order the item lists them. Unknown keys are skipped.
export function sourcesForItem(item, sourcesByKey) {
  const keys = Array.isArray(item && item.source_keys) ? item.source_keys : [];
  return keys.map(k => (sourcesByKey || {})[k]).filter(Boolean);
}

// Only ever link to a secure web address.
export function safeUrl(url) {
  const u = String(url || '').trim();
  return /^https:\/\/[^\s]+$/i.test(u) ? u : '';
}

// A source counts as fully checked only when its status says Verified and names no open point.
export function isFullyChecked(source) {
  const s = String((source && source.status) || '');
  return /^Verified/i.test(s) && !/to verify|partly|re-?check/i.test(s);
}

// Short tag for the row: null when the item has no source, otherwise how far the sources are checked.
export function sourceTag(item, sourcesByKey) {
  const list = sourcesForItem(item, sourcesByKey);
  if (list.length === 0) return null;
  return list.every(isFullyChecked) ? 'Source checked' : 'Source partly checked';
}

export const NO_SOURCE_NOTE =
  'No source recorded for this item yet. It is good practice, a decision for your marae, or not yet checked.';

export function hasSources(item) {
  return Array.isArray(item && item.source_keys) && item.source_keys.length > 0;
}
