import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

if (window.location.pathname === '/index' || window.location.pathname === '/index.html') {
  window.history.replaceState(null, '', '/')
}

// Recover from stale dynamic-import chunks after a new deploy.
// When the cached index references a chunk hash that no longer exists,
// reload once (using a sessionStorage guard to avoid loops).
const RELOAD_KEY = '__chunk_reload_attempted__'
function isChunkLoadError(message) {
  if (!message) return false
  const m = String(message)
  return (
    m.includes('Failed to fetch dynamically imported module') ||
    m.includes('Importing a module script failed') ||
    m.includes('error loading dynamically imported module')
  )
}
function handleChunkError(message) {
  if (!isChunkLoadError(message)) return
  try {
    if (sessionStorage.getItem(RELOAD_KEY)) return
    sessionStorage.setItem(RELOAD_KEY, '1')
    window.location.reload()
  } catch {
    window.location.reload()
  }
}
window.addEventListener('error', (e) => handleChunkError(e?.message))
window.addEventListener('unhandledrejection', (e) => handleChunkError(e?.reason?.message || e?.reason))
window.addEventListener('load', () => {
  try { sessionStorage.removeItem(RELOAD_KEY) } catch {}
})


createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
