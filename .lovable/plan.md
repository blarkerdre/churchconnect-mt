

## Public WoFBI Course Registration

### Problem
The WoFBI registration QR code currently points to `/exam-management`, which requires authentication. Non-users and non-members cannot register for courses.

### Approach
Create a new public page at `/wofbi-register` that anyone can access without logging in. This page will collect basic personal info and register them for a selected course, reusing the existing `public-register` Edge Function pattern for creating member records.

### Changes

**1. New page: `src/pages/PublicWoFBIRegistration.jsx`**
- Public page (no auth required) with a clean registration form
- Fetches active courses with `registration_open = true` from `exam_titles` (anon SELECT is already allowed via `Authenticated can view exam titles` — need to add anon policy)
- Form fields: First Name, Last Name, Email, Phone, selected Course, GDPR consent, honeypot
- On submit, calls a new Edge Function `public-wofbi-register` that:
  - Creates or finds an existing member record (by email match)
  - Inserts a `course_registrations` row
  - Returns success
- Shows confirmation on success

**2. Database migration — Add anon SELECT policy on `exam_titles`**
- Allow anonymous users to view active courses with open registration so the public page can list them

**3. New Edge Function: `supabase/functions/public-wofbi-register/index.ts`**
- Accepts: first_name, last_name, email, phone, course_id, gdpr_consent, website (honeypot)
- Validates and sanitizes inputs (reuses patterns from `public-register`)
- Rate limits by IP (same pattern)
- Uses service role to:
  - Find existing member by email or create a new one
  - Check course exists and `registration_open = true`
  - Insert `course_registrations` (check for duplicates)
- Triggers welcome email if new member
- Returns success

**4. Update `src/App.jsx`**
- Add public route: `<Route path="/wofbi-register" element={<PublicWoFBIRegistration />} />`

**5. Update `WoFBIRegistrationQRCode.jsx`**
- Change URL from `/exam-management` to `/wofbi-register`

**6. Update `supabase/config.toml`**
- Add `verify_jwt = false` for `public-wofbi-register` function

### Technical details
- The Edge Function uses `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS for inserts
- Member deduplication: if email matches an existing unlinked member, reuse that record
- Course registration deduplication: check existing `course_registrations` before inserting
- No auth required — the function handles security via rate limiting, honeypot, and input validation

