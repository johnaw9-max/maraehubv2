// Remembers which page a trustee was on, so a refresh, a background update or
// a quick trip to another tab or window puts them back where they were instead
// of on the Board View. Kept per tab (sessionStorage) and per person, so it
// disappears when the tab is closed and never carries over to another login.

const PREFIX = 'maraehub:active-tab:';

function storage() {
  try { return window.sessionStorage; } catch (e) { return null; }
}

// Returns the saved page key, but only if it is still one the person is
// allowed to open (validKeys comes from the nav they can actually see).
export function readSavedTab(userId, validKeys) {
  if (!userId) return null;
  const s = storage();
  if (!s) return null;
  try {
    const saved = s.getItem(PREFIX + userId);
    return saved && validKeys.includes(saved) ? saved : null;
  } catch (e) {
    return null;
  }
}

export function saveTab(userId, key) {
  if (!userId || !key) return;
  const s = storage();
  if (!s) return;
  try { s.setItem(PREFIX + userId, key); } catch (e) { /* storage full or blocked: not worth failing over */ }
}

export function forgetSavedTab(userId) {
  if (!userId) return;
  const s = storage();
  if (!s) return;
  try { s.removeItem(PREFIX + userId); } catch (e) { /* ignore */ }
}
