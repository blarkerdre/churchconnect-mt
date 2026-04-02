

## Update Logos on Auth & Landing Pages

Use the existing uploaded image `/lovable-uploads/40e09a54-d633-4f1c-bbfc-1ef23b34fa49.png` as the default logo on both pages.

### Changes

**`src/pages/Auth.jsx`** — Add a default logo when no tenant logo exists (generic `/auth` route):

```jsx
{tenant?.logo_url ? (
  <img src={tenant.logo_url} alt={churchName} className="h-16 w-auto mb-3 object-contain" />
) : (
  <img src="/lovable-uploads/40e09a54-d633-4f1c-bbfc-1ef23b34fa49.png" alt="Church Connect" className="h-16 w-auto mb-3 object-contain" />
)}
```

**`src/pages/LandingPage.jsx`** — Already uses this image. No changes needed.

### Files changed
- `src/pages/Auth.jsx` — show default ChurchConnect logo when no tenant branding

