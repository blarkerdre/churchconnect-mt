import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

if (window.location.pathname === '/index' || window.location.pathname === '/index.html') {
  window.history.replaceState(null, '', '/')
}

// Recover from stale dynamic-import chunks after a new deploy.
// The cached index.html references chunk hashes that no longer exist on the
// CDN. Clear caches + service workers and hard-reload — at most once per
// cooldown window (shared guard), so a broken chunk can't loop reloads.
import { hardReload } from './lib/lazy-retry.js'

function isChunkLoadError(message) {
  if (!message) return false
  const m = String(message)
  return (
    m.includes('Failed to fetch dynamically imported module') ||
    m.includes('Importing a module script failed') ||
    m.includes('error loading dynamically imported module') ||
    m.includes('Unable to preload CSS')
  )
}
function handleChunkError(message) {
  if (!isChunkLoadError(message)) return
  hardReload()
}
window.addEventListener('error', (e) => { handleChunkError(e?.message) })
window.addEventListener('unhandledrejection', (e) => {
  const reason = e?.reason
  handleChunkError(typeof reason === 'string' ? reason : reason?.message)
})




createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
