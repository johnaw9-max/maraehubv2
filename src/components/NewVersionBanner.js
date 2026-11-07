import React, { useEffect, useState } from 'react';

// Tells people when a newer version of MaraeHub has been published, so a tab or
// home-screen app that has been open for days does not keep running old code.
// Compares the main script file this page loaded with the one index.html names now.
// Nothing is reloaded automatically: the person chooses when, so nothing they are
// typing is lost.

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

const CHECK_EVERY_MS = 5 * 60 * 1000;

export default function NewVersionBanner() {
  const [stale, setStale] = useState(false);

  useEffect(() => {
    const mine = runningBundle();
    if (!mine) return undefined; // dev server or unknown build: do nothing
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch('/index.html?v=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) return;
        const latest = bundleInHtml(await res.text());
        if (!cancelled && latest && latest !== mine) setStale(true);
      } catch (e) { /* offline: try again later */ }
    }

    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    check();
    const timer = setInterval(check, CHECK_EVERY_MS);
    document.addEventListener('visibilitychange', onVisible);
    return () => { cancelled = true; clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
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
