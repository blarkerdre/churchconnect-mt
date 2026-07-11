## No code change required

The Bible School (WOFBI) registration form already pulls the Privacy Policy URL from **Settings → Consent & Privacy** and renders "Privacy Policy" as a clickable link when a URL is saved.

### How it works today
- `src/components/settings/ConsentPrivacySection.jsx` saves `privacy_policy_url` into `app_settings` (tenant-scoped).
- `usePublicConsentText(tenantId)` in `src/hooks/useConsentText.jsx` reads that value.
- `renderConsentText(consentText, privacyUrl)` splits the consent statement on the phrase "Privacy Policy" and wraps it in an `<a href={privacyUrl} target="_blank">` when the URL is non-empty.
- `PublicWoFBIRegistration.jsx` (`WoFBIConsentBlock`) uses that helper, so signed-in and public submissions both get the link.

### To activate the link
1. Open **Settings → Consent & Privacy**.
2. Paste the Privacy Policy URL into the *Privacy Policy URL (Optional)* field (e.g. the winners-chapel WMA policy PDF shown as placeholder).
3. Click **Save Consent Settings**.

The next time the Bible School registration form loads, "Privacy Policy" in the consent line will render as a link opening the saved URL in a new tab. The same applies to the other public/member forms that share this helper (Public Registration, Member Form Dialog, My Profile).

If after saving the URL the link still doesn't appear, tell me and I'll investigate (likely a cache/refresh issue on that specific form).
