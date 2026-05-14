## Problem

The live site at `app.churchmanagementsuite.org` is blank. Console shows:

```
TypeError: createRoot(...).render is not a function
  at assets/index-BTghYNCR.js
```

Cause: `src/main.jsx` uses the legacy import:

```js
import ReactDOM from 'react-dom'
ReactDOM.createRoot(document.getElementById('root')).render(...)
```

With React 18+, `createRoot` must be imported from `react-dom/client`. The default `react-dom` export's `createRoot` re-export is unreliable in production builds — combined with the Vite alias that pins `react-dom` but not `react-dom/client`, the two entry points can resolve differently and `createRoot()` returns an object whose `.render` is undefined.

## Fix

### 1. `src/main.jsx` — use the correct entry point

```js
import { createRoot } from 'react-dom/client'
// ...
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

(Keep the SW registration block exactly as it is.)

### 2. `vite.config.js` — also alias `react-dom/client`

Add to the `resolve.alias` block so React/ReactDOM stay a single instance:

```js
'react-dom/client': path.resolve(__dirname, './node_modules/react-dom/client'),
```

This matches the existing aliases for `react`, `react-dom`, and `react/jsx-runtime` and is consistent with the project's "Single React instance via Vite aliasing" rule.

## Verification

After publishing:
1. Hard-refresh `https://app.churchmanagementsuite.org/` — landing page should render.
2. Console should be clean (no `createRoot` TypeError).
3. The auto-updating service worker we just shipped will then propagate to existing PWA installs as designed.

## Out of scope

- No SW changes needed — `public/sw.js` and the registration logic in `main.jsx` are correct; the SW just couldn't help because the React bootstrap itself was broken.
- No dependency upgrades.
