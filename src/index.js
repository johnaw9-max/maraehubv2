import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import './index.css';
import App from './App';

Sentry.init({
  dsn: process.env.REACT_APP_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: 0.1,
});

// A deploy can replace a lazy-loaded route's JS chunk (e.g. /founder) out from under
// a tab that's already open. The old chunk filename then 404s, but vercel.json's SPA
// rewrite serves index.html instead, and the browser throws trying to parse it as JS
// ("Unexpected token '<'"). Reload once to pick up the current build; a second failure
// falls through to the manual-refresh fallback instead of reload-looping.
function isStaleChunkError(error) {
  const message = error?.message || '';
  return /Loading chunk .* failed|Loading CSS chunk .* failed|Failed to fetch dynamically imported module|Unexpected token '<'/i.test(message);
}

function handleAppError(error) {
  if (isStaleChunkError(error) && !sessionStorage.getItem('stale-chunk-reload-attempted')) {
    sessionStorage.setItem('stale-chunk-reload-attempted', '1');
    window.location.reload();
  }
}

function ErrorFallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16 }}>
      <div style={{ width: 48, height: 48, background: '#1a4a3a', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'serif', fontWeight: 700, fontSize: 22, color: '#c8902a' }}>M</div>
      <div style={{ color: '#7a7268', fontSize: 14, textAlign: 'center', maxWidth: 320 }}>
        Something went wrong. Please refresh the page.
      </div>
      <button onClick={() => window.location.reload()} style={{ padding: '8px 20px', background: '#1a4a3a', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>
        Refresh
      </button>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<ErrorFallback />} onError={handleAppError}>
      <App />
    </Sentry.ErrorBoundary>
  </React.StrictMode>
);
