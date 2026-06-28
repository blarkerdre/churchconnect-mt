import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

if (window.location.pathname === '/index' || window.location.pathname === '/index.html') {
  window.history.replaceState(null, '', '/')
}

// Recover from stale dynamic-import chunks after a new deploy.
// The cached index.html references chunk hashes that no longer exist on the
// CDN. Clear caches + service workers and hard-reload once with a cache-bust.
const RELOAD_KEY = '__chunk_reload_attempted__'
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
async function handleChunkError(message) {
  if (!isChunkLoadError(message)) return
  try {
    if (sessionStorage.getItem(RELOAD_KEY)) return
    sessionStorage.setItem(RELOAD_KEY, '1')
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map((r) => r.unregister()))
      }
    } catch {}
    try {
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
      }
    } catch {}
    const url = new URL(window.location.href)
    url.searchParams.set('_r', Date.now().toString())
    window.location.replace(url.toString())
  } catch {
    window.location.reload()
  }
}
window.addEventListener('error', (e) => { handleChunkError(e?.message) })
window.addEventListener('unhandledrejection', (e) => {
  const reason = e?.reason
  handleChunkError(typeof reason === 'string' ? reason : reason?.message)
})
window.addEventListener('load', () => {
  setTimeout(() => { try { sessionStorage.removeItem(RELOAD_KEY) } catch {} }, 5000)
})



createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
