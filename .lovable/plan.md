

## Make Privacy Policy URL Optional + Fix Runtime Error

### Problem
1. **Runtime error**: `MemberConsentBlock is not defined` — the component is defined at the bottom of `MemberFormDialog.jsx` but referenced before its declaration (likely a hoisting issue with the function expression).
2. **Privacy Policy URL is always rendered as a link**, even when no URL is configured. It should only show the "Privacy Policy" link when a URL is provided.

### Changes

#### 1. Fix runtime error in `MemberFormDialog.jsx`
Move the `MemberConsentBlock` function definition above the main `MemberFormDialog` component, or ensure it's properly hoisted. Since it's a `function` declaration (not const/arrow), it should hoist — need to verify the exact cause. Most likely the component needs to be moved before the main export.

#### 2. Make Privacy Policy link conditional in all 4 consent blocks
In each consent block (`MemberFormDialog.jsx`, `PublicRegistration.jsx`, `PublicWoFBIRegistration.jsx`, `MyProfile.jsx`):
- If `privacyUrl` is set, render "Privacy Policy" as a clickable link (current behavior)
- If `privacyUrl` is empty/null, render "Privacy Policy" as plain text (no link)

#### 3. Update `useConsentText.jsx` hook
Change the fallback for `privacyUrl` from `DEFAULT_PRIVACY_URL` to `null` or `""`, so tenants that haven't set a URL don't get the default WMA link. The default URL will only be shown as a placeholder in the settings form.

Alternatively, keep the default but allow tenants to explicitly clear it. The simpler approach: keep the default URL as fallback (since most tenants are WMA churches), but if the consent text doesn't contain "Privacy Policy", don't append a link at all.

#### 4. Settings form — mark URL as optional
In `ConsentPrivacySection.jsx`, update the label/helper text to indicate the URL is optional.

### Files changed
- `src/components/members/MemberFormDialog.jsx` — fix runtime error + conditional link
- `src/pages/PublicRegistration.jsx` — conditional link
- `src/pages/PublicWoFBIRegistration.jsx` — conditional link
- `src/pages/MyProfile.jsx` — conditional link
- `src/hooks/useConsentText.jsx` — allow null/empty privacy URL
- `src/components/settings/ConsentPrivacySection.jsx` — mark URL as optional in UI

