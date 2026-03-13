import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'

// Redirect /index to /
if (window.location.pathname === '/index' || window.location.pathname === '/index.html') {
  window.history.replaceState(null, '', '/');
}

const root = ReactDOM.createRoot(document.getElementById('root'));

const requiredVars = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY'];
const missing = requiredVars.filter(v => !import.meta.env[v]);

if (missing.length > 0) {
  root.render(
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 24, fontFamily: 'system-ui, sans-serif', background: '#f9fafb' }}>
      <div style={{ maxWidth: 480, textAlign: 'center' }}>
        <h1 style={{ fontSize: 20, marginBottom: 8, color: '#111' }}>Configuration Missing</h1>
        <p style={{ color: '#666', fontSize: 14 }}>
          Required environment variables are not set: <strong>{missing.join(', ')}</strong>.
          Please re-sync your backend integration and refresh.
        </p>
      </div>
    </div>
  );
} else {
  import('./App.jsx').then(({ default: App }) => {
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  });
}
