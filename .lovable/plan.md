## Real root cause

The blank live page is **not** a React/createRoot import issue. It's an ASI (Automatic Semicolon Insertion) bug in `src/main.jsx`.

The file currently ends like this:

```js
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Service worker registration with auto-update.
(() => {
  if (!('serviceWorker' in navigator)) return;
  // ...
})();
```

After Vite minifies it, the newline collapses and the IIFE that begins with `(` is fused onto the previous expression:

```js
createRoot(...).render(<...>)(()=>{...})()
```

JavaScript parses that as `render(...)(...)` — calling the result of `.render()` (which returns `undefined`) as a function. That throws `TypeError: createRoot(...).render(...) is not a function`, the React tree never mounts, and the page stays blank.

## Fix

Add a single semicolon after the `.render(...)` call in `src/main.jsx`:

```js
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);   // ← this semicolon
```

Defensive cleanup (same file): also put a leading `;` before the SW IIFE so this class of bug can't reappear if anyone edits the bracketing later:

```js
;(() => {
  if (!('serviceWorker' in navigator)) return;
  // ...
})();
```

## Revert the speculative change

In `vite.config.js`, remove the `react-dom/client` alias I added in the previous turn. It wasn't the cause and isn't needed:

```diff
       'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
-      'react-dom/client': path.resolve(__dirname, './node_modules/react-dom/client.js'),
       'react/jsx-runtime': path.resolve(__dirname, './node_modules/react/jsx-runtime'),
```

The named `import { createRoot } from 'react-dom/client'` in `main.jsx` is correct and stays.

## Verification

1. Run `vite build` locally and grep the output bundle for `render(` — confirm there is a `;` (or a `,` separator) between `.render(...)` and the next statement.
2. Publish.
3. Open `https://app.churchmanagementsuite.org/` — landing page must render and console must be clean.
