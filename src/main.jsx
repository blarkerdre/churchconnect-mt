import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'

if (window.location.pathname === '/index' || window.location.pathname === '/index.html') {
  window.history.replaceState(null, '', '/')
}

const root = ReactDOM.createRoot(document.getElementById('root'))

const renderConfigError = (details = '') => {
  root.render(
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-lg space-y-2 text-center">
        <h1 className="text-xl font-semibold text-foreground">Configuration Missing</h1>
        <p className="text-sm text-muted-foreground">
          Required environment variables are not available in the current preview runtime.
          Please re-sync backend integration and refresh.
        </p>
        {details ? (
          <p className="text-xs text-muted-foreground/80 break-words">{details}</p>
        ) : null}
      </div>
    </div>
  )
}

import('./App.jsx')
  .then(({ default: App }) => {
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    )
  })
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    const isEnvError =
      /supabaseurl\s+is\s+required/i.test(message) ||
      /VITE_SUPABASE_URL|VITE_SUPABASE_PUBLISHABLE_KEY/i.test(message)

    if (isEnvError) {
      renderConfigError(message)
      return
    }

    throw error
  })
