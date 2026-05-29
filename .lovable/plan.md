# Fix Settings page not rendering

## Root cause

`src/pages/Settings.jsx` renders `<ConsentPrivacySection />` at line 1686, but the component is never imported. At runtime React throws `ConsentPrivacySection is not defined`, so the whole Settings route fails to render.

The component file `src/components/settings/ConsentPrivacySection.jsx` exists and exports a default — only the import statement is missing (likely lost during the recent Features tab merge).

## Fix

Add the missing import alongside the other settings-section imports in `src/pages/Settings.jsx`:

```js
import ConsentPrivacySection from "@/components/settings/ConsentPrivacySection";
```

That's the only change required. No logic, styling, or other tabs are affected.
