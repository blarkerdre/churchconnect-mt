# Allow signed-in users to fill the Bible School application

Currently `/t/:tenantSlug/register/wofbi` is a public, unauthenticated form. When the admin toggle is on, we want authenticated members to be able to apply too — both from inside the app and by reusing the public URL while signed in.

## 1. Reuse the public page for signed-in users

Edit `src/pages/PublicWoFBIRegistration.jsx`:
- Detect the current session via `useAuth` (safe fallback if no `AuthProvider` wraps the route — we'll wrap it, see step 3).
- If a session exists AND that user has a `members` row in the resolved tenant, prefill `first_name`, `last_name`, `email`, `phone` and mark these fields read-only (email at minimum).
- Show a small banner: "Signed in as {email} — this application will be linked to your member profile."
- On submit, include `user_id` in the payload so the edge function links the submission to the existing member instead of creating a duplicate.
- After submit, the "Login / Create Account" CTA becomes "Go to Bible School".

## 2. In-app entry point (Bible School / My Exams)

Add a "Register for a course" button on the member-facing Bible School surface (the same page where members see their exams — currently rendered inside `ExamManagement.jsx` / member view). The button is only shown when `wofbi_application_forms.enabled = true` for the tenant AND the member does not already have a `course_registrations` row for every open course.

Two options for the click target — plan chooses **B** for simplicity:
- A. Open the dynamic form inline in a dialog.
- B. **Navigate to `/t/:tenantSlug/register/wofbi`** (which now supports signed-in users from step 1). Simpler, single source of truth.

Also add a matching entry point on the member Dashboard when the toggle is on (small card: "Bible School applications are open").

## 3. Routing

In `src/App.jsx`, the `/t/:tenantSlug/register/wofbi` route currently renders without an `AuthProvider`. Wrap it (like `/accept-invite`) so `useAuth` works, but keep the route public — anonymous users still see the form as today.

## 4. Edge function `public-wofbi-register`

Update `supabase/functions/public-wofbi-register/index.ts`:
- Accept an optional `Authorization: Bearer <access_token>` header. When present, verify it with the service-role client (`supabase.auth.getUser(token)`), then:
  - Look up the caller's `members` row in the tenant by `user_id`. If found, use that `member_id` instead of matching by email; do NOT create a new member.
  - Ignore the client-supplied name/email for the member record — trust the linked profile — but still store what was submitted inside `wofbi_applications.answers` and top-level fields.
- If no auth header, behavior is unchanged (existing public flow).
- Keep the rate limit; skip it for authenticated calls (or use `user_id` as the key).
- Duplicate-registration check (`course_registrations` for this member + course) already prevents double-apply.

## 5. Client submission

`PublicWoFBIRegistration.jsx` submits to the function. When signed in, attach the current access token in the `Authorization` header so the function can identify the user.

## Files to touch

- edit `src/pages/PublicWoFBIRegistration.jsx` — session detection, prefill, auth header
- edit `src/App.jsx` — wrap the WOFBI register route in `AuthProvider`
- edit `supabase/functions/public-wofbi-register/index.ts` — optional auth, member lookup by user_id
- edit `src/pages/ExamManagement.jsx` (member view section) — "Register for a course" button when toggle is on
- edit `src/components/dashboard/MemberDashboard.jsx` — optional entry card when toggle is on

## Non-goals

- No change to the form schema, admin editor, or Applications tab.
- No change to `wofbi_applications` table.
- No change to the anonymous flow behavior.
