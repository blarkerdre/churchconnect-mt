

## Allow Tenants to Customize Consent Text

### Problem
The GDPR consent statement is hardcoded as "By completing this form, you agree that WMA-WCI will use, process and retain your personal data..." across 4 files. Each tenant (church) should be able to customize this text and the privacy policy URL.

### Solution
Store custom consent text and privacy policy URL in `app_settings` (keys: `consent_text`, `privacy_policy_url`). Add a settings UI for admins to edit them. Update all 4 forms to read from the setting, falling back to the current default.

### Changes

#### 1. Settings UI — `src/pages/Settings.jsx`
Add a "Consent & Privacy" card (in the General or a new section) with:
- A `<Textarea>` for custom consent text (placeholder shows the default)
- An `<Input>` for the privacy policy URL
- Save button that upserts into `app_settings` with keys `consent_text` and `privacy_policy_url`

#### 2. New hook — `src/hooks/useConsentText.jsx`
A small hook that reads `consent_text` and `privacy_policy_url` from `app_settings` via `useAppSetting`, returning the text and URL with sensible defaults:
- Default text: `"By completing this form, you agree that {church_name} will use, process and retain your personal data in accordance with our Privacy Policy. You have the right to withdraw this consent at any time."`
- Default URL: `"https://winners-chapel.org.uk/wp-content/uploads/2024/11/WMA_PrivacyPolicy2024.pdf"`

#### 3. Update consent display in 4 files
Replace the hardcoded consent text with data from `useConsentText()`:
- `src/pages/PublicRegistration.jsx` (line ~360)
- `src/pages/PublicWoFBIRegistration.jsx` (line ~253)
- `src/pages/MyProfile.jsx` (line ~856)
- `src/components/members/MemberFormDialog.jsx` (line ~638)

Each will render the custom text with an embedded link to the privacy policy URL.

#### 4. Public pages tenant resolution
`PublicRegistration.jsx` already resolves `tenantId` from the URL slug. `PublicWoFBIRegistration.jsx` may need the tenant context passed through to fetch the correct setting. Both public pages will fetch the setting using a direct query (since `useAppSetting` requires auth context, public pages will query with the anon key or use a simpler fetch).

### Technical Notes
- No database migration needed — `app_settings` already supports arbitrary keys per tenant
- The `useAppSetting` hook already handles tenant scoping
- For public (unauthenticated) pages, we'll fetch `app_settings` directly with `.eq("key", "consent_text")` and filter by tenant — the RLS allows authenticated reads, but public pages use anon. We may need to add a SELECT policy for anon on `app_settings` for these specific keys, OR pass the consent text as props from the tenant data that's already fetched on public pages.

### Files changed
- `src/hooks/useConsentText.jsx` — new hook
- `src/pages/Settings.jsx` — add consent editing section
- `src/pages/PublicRegistration.jsx` — use dynamic consent text
- `src/pages/PublicWoFBIRegistration.jsx` — use dynamic consent text
- `src/pages/MyProfile.jsx` — use dynamic consent text
- `src/components/members/MemberFormDialog.jsx` — use dynamic consent text

