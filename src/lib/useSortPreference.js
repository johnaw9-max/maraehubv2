import { useState } from 'react';

// Consistent Sort (14yhc7kpea4) Step 4, Part 2. Per-browser via localStorage,
// not per-account -- confirmed choice: no schema/migration needed, matches
// the app's one existing preference-like precedent (WhatsNew.js's
// "seen this version" flag), proportionate to how minor this personalization
// is. Trades off following a trustee across devices, and could carry over
// between different people sharing one browser profile -- accepted tradeoff.
export function useSortPreference(moduleKey, defaultMode) {
  const storageKey = `mh_sort_${moduleKey}`;

  const [mode, setModeState] = useState(() => {
    try {
      return localStorage.getItem(storageKey) || defaultMode;
    } catch {
      return defaultMode;
    }
  });

  function setMode(next) {
    setModeState(next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      // localStorage unavailable (private browsing, quota) -- preference
      // just won't persist this session, not worth surfacing an error for.
    }
  }

  return [mode, setMode];
}
