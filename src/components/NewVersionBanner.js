import React, { useEffect, useRef, useState } from 'react';
import { updatesHeld } from '../lib/updateGuard';

// Tells people when a newer version of MaraeHub has been published, so a tab or
// home-screen app that has been open for days does not keep running old code.
// Compares the main script file this page loaded with the one index.html names now.
//
// A page cannot swap its own running code, so "instant" means reloading by itself at a
// moment when that costs the person nothing. It does so only when ALL of these hold:
//   - nobody has typed or picked a file in the last 10 minutes (nothing unsaved)
//   - the tab is in the background, or they have been idle for a minute
//   - no screen is holding updates (live meeting view, voice dictation)
//   - it has not already auto-reloaded in the last 2 minutes (no reload loops)
// Otherwise the "new version ready" banner stays and the person chooses when.

export function runningBundle(doc = document) {
  const el = Array.from(doc.querySelectorAll('script[src]'))
    .map(s => s.getAttribute('src'))
    .find(src => /\/static\/js\/main\.[^/]+\.js/.test(src || ''));
  const m = el && el.match(/main\.([^./]+)\.js/);
  return m ? m[1] : null;
}

export function bundleInHtml(html) {
  const m = /\/static\/js\/main\.([^./"']+)\.js/.exec(html || '');
  return m ? m[1] : null;
}

const CHECK_EVERY_MS = 60 * 1000;
const TYPED_QUIET_MS = 10 * 60 * 1000;
const IDLE_MS = 60 * 1000;
const RELOAD_GAP_MS = 2 * 60 * 1000;

// Pure so it can be tested: should the page reload itself now?
export function canAutoReload({ now, lastTypedAt, lastActiveAt, hidden, held, lastAutoReloadAt }) {
  if (held) return false;
  if (now - lastTypedAt < TYPED_QUIET_MS) return false;
  if (lastAutoReloadAt && now - lastAutoReloadAt < RELOAD_GAP_MS) return false;
  return hidden || now - lastActiveAt >= IDLE_MS;
}

export default function NewVersionBanner() {
  const [stale, setStale] = useState(false);
  const staleRef = useRef(false);

  useEffect(() => {
    const mine = runningBundle();
    if (!mine) return undefined; // dev server or unknown build: do nothing
    let cancelled = false;
    const t0 = Date.now();
    let lastTypedAt = 0;          // 0 = never typed
    let lastActiveAt = t0;
    const typed = () => { lastTypedAt = Date.now(); lastActiveAt = lastTypedAt; };
    const active = () => { lastActiveAt = Date.now(); };

    function maybeAutoReload() {
      if (!staleRef.current) return;
      let lastAutoReloadAt = 0;
      try { lastAutoReloadAt = Number(sessionStorage.getItem('auto-update-reload-at')) || 0; } catch (e) { /* ignore */ }
      const ok = canAutoReload({
        now: Date.now(), lastTypedAt: lastTypedAt || -Infinity, lastActiveAt,
        hidden: document.visibilityState === 'hidden', held: updatesHeld(), lastAutoReloadAt,
      });
      if (!ok) return;
      try { sessionStorage.setItem('auto-update-reload-at', String(Date.now())); } catch (e) { /* ignore */ }
      window.location.reload();
    }

    async function check() {
      try {
        const res = await fetch('/index.html?v=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) return;
        const latest = bundleInHtml(await res.text());
        if (!cancelled && latest && latest !== mine) { staleRef.current = true; setStale(true); }
      } catch (e) { /* offline: try again later */ }
      maybeAutoReload();
    }

    const onVisibility = () => { if (document.visibilityState === 'visible') check(); else maybeAutoReload(); };
    const activeEvents = ['pointerdown', 'keydown', 'scroll', 'touchstart'];
    const typedEvents = ['input', 'change'];
    activeEvents.forEach(e => window.addEventListener(e, active, true));
    typedEvents.forEach(e => window.addEventListener(e, typed, true));
    check();
    const timer = setInterval(check, CHECK_EVERY_MS);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true; clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      activeEvents.forEach(e => window.removeEventListener(e, active, true));
      typedEvents.forEach(e => window.removeEventListener(e, typed, true));
    };
  }, []);

  if (!stale) return null;
  return (
    <div role="status" style={{
      position: 'fixed', left: 12, right: 12, bottom: 12, zIndex: 9999, maxWidth: 460, margin: '0 auto',
      background: '#1a4a3a', color: '#fff', borderRadius: 10, padding: '12px 14px',
      display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.25)', fontSize: 14,
    }}>
      <span style={{ flex: 1 }}>A new version of MaraeHub is ready.</span>
      <button onClick={() => window.location.reload()} style={{ background: '#c8902a', color: '#1a1a1a', border: 'none', borderRadius: 8, padding: '7px 14px', fontWeight: 600, cursor: 'pointer' }}>
        Refresh
      </button>
      <button onClick={() => setStale(false)} aria-label="Dismiss" style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
    </div>
  );
}
