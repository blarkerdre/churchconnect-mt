

## Replace Logo & Church Name with "Church Connect" on Auth Page

### Changes

**`src/pages/Auth.jsx`**

1. **Remove logo image** — Delete the `<img>` tag on line 176 and remove the `winnersLogo` import (line 11)
2. **Replace default name** — Change `churchName` fallback from `"Winners Chapel"` to `"Church Connect"` (line 72)
3. **Remove subtitle** — Change `churchSubtitle` to always be `null` (line 73), since "International" is no longer relevant
4. **Clean up** — Remove unused `logoUrl` variable (line 74)

When a tenant **is** loaded (has branding), the tenant name still displays. When no tenant is found, it shows "Church Connect" with no logo and no subtitle.

### Files changed
- `src/pages/Auth.jsx` — remove logo, update default name to "Church Connect", remove subtitle

