import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

if (window.location.pathname === '/index' || window.location.pathname === '/index.html') {
  window.history.replaceState(null, '', '/')
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Service worker registration with auto-update.
// Disabled inside iframes and Lovable preview hosts to keep the editor preview clean.
;(() => {
  if (!('serviceWorker' in navigator)) return;

  const isInIframe = (() => {
    try { return window.self !== window.top; } catch { return true; }
  })();
  const host = window.location.hostname;
  const isPreviewHost =
    host.includes('id-preview--') ||
    host.includes('lovableproject.com') ||
    host === 'localhost' ||
    host === '127.0.0.1';

  if (isInIframe || isPreviewHost) {
    // Make sure no stale SW is running in the editor preview
    navigator.serviceWorker.getRegistrations().then((regs) =>
      regs.forEach((r) => r.unregister())
    );
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        // Check for updates whenever the tab regains focus
        const checkForUpdate = () => reg.update().catch(() => {});
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') checkForUpdate();
        });
        // And periodically (every 30 minutes)
        setInterval(checkForUpdate, 30 * 60 * 1000);

        // When a new worker takes over, reload once to pick up the new assets
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (refreshing) return;
          refreshing = true;
          window.location.reload();
        });

        // If a new worker is already waiting, tell it to activate
        const promote = (worker) => worker?.postMessage('SKIP_WAITING');
        if (reg.waiting) promote(reg.waiting);
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener('statechange', () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
              promote(nw);
            }
          });
        });
      })
      .catch(() => {});
  });
})();
