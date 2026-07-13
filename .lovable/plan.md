# Account-less Bible School exam taking

## Goal
Approved Bible School applicants should be able to write their exam without ever signing up or choosing a password. On approval we silently create a Lovable Cloud auth user + linked member record for them, then email a one-click magic link that signs them in and drops them straight into their exam.

## User flow

```text
Public /wofbi-register  ──►  wofbi_applications row (status = pending)
Admin approves in Bible School → Applications tab
        │
        ▼
Edge fn: provision-exam-account
  • Ensures auth.users row for applicant.email (invite / passwordless)
  • Ensures members row in tenant, linked via user_id + application_id
  • Marks course_registrations approved + active (existing behaviour)
  • Sends "Your exam is ready" app email with magic-link URL
        │
        ▼
Applicant clicks link  ──►  /auth/exam-callback?next=/exam-management
  • Supabase exchanges the token, session hydrates
  • Redirects to Exam Management for the assigned course
  • TakeExamDialog runs as today (memberId now exists)
```

## Scope: only approved applicants
- No public "anyone can attempt" URL. Access is gated by:
  1. An approved `wofbi_applications` row.
  2. A valid, single-use magic link Supabase issues to that email.
  3. Standard `exam_attempts` RLS on the resulting `user_id` / `member_id`.
- Re-sending the link is an admin action on the Applications tab (button per approved row) and idempotent.

## Changes

### 1. Edge function `provision-exam-account` (new)
`supabase/functions/provision-exam-account/index.ts`
- Input: `{ application_id }` (admin-only; verifies caller is tenant admin via `user_belongs_to_tenant` + role check).
- Loads `wofbi_applications` row → email, names, tenant_id, course/exam target.
- Uses service role to:
  - `auth.admin.getUserByEmail` → if missing, `auth.admin.createUser({ email, email_confirm: true })`.
  - Upsert `members` row keyed on `(tenant_id, user_id)` with names/email/phone; link `application_id`.
  - Ensure `course_registrations` for the applicant is `approved` / `active` (delegates to existing helper if present; otherwise inline update scoped by `tenant_id`).
  - `auth.admin.generateLink({ type: 'magiclink', email, options: { redirectTo: `${SITE_URL}/auth/exam-callback?next=/t/<slug>/exam-management` } })`.
- Enqueues app email via `send-transactional-email` with template `bible-school-exam-ready` and `templateData: { firstName, courseName, magicLink, tenantName }`.
- Returns `{ ok, member_id }`.

### 2. Applications tab wiring
`src/components/exams/WoFBIApplicationsTab.jsx`
- On successful "Approve" mutation (form-source branch, ~line 166+), invoke `provision-exam-account` with the application id, then toast "Applicant provisioned and exam link sent".
- Add a small "Resend exam link" action for rows whose status is already `approved` that re-invokes the same function.

### 3. Email template
`supabase/functions/_shared/transactional-email-templates/bible-school-exam-ready.tsx`
- Registered in `registry.ts`. Brand-styled per existing tenant email conventions. CTA button → magic link. Body explains: click to sign in and start the exam; link is one-time and expires.
- Requires app-email infra + a configured email domain — if the project doesn't have one yet, we set that up first via the standard dialog.

### 4. Sign-in callback
`src/pages/AuthExamCallback.jsx` (new) mounted at `/auth/exam-callback` as a public route in `src/App.jsx`.
- On mount: `supabase.auth.getSession()`. If session exists, read `?next=` and `navigate(next || '/')`. If missing (link expired / already used), show a friendly "Link expired — ask your church admin to resend" screen.

### 5. Existing exam page
No changes to `ExamManagement.jsx` / `TakeExamDialog.jsx`. Once the applicant is signed in with an auth user + linked member, they satisfy the existing `ProtectedRoute` and RLS on `exam_attempts` unchanged.

## Security notes
- Magic-link redirect stays same-origin (`window.location.origin`), never straight into a protected route.
- Only admins/owners of the tenant can invoke `provision-exam-account`; enforced via JWT + `user_belongs_to_tenant` and role check inside the function.
- The magic link is Supabase-issued (single-use, TTL-bound); we don't roll a custom token.
- Members row is upserted with `(user_id, tenant_id)` uniqueness to satisfy the multi-tenancy integrity rule.

## Out of scope
- No public "guest attempt" mode.
- No password creation UI; applicants stay passwordless unless they later set one from account settings.
- No changes to grading, retake, or certificate flows.
