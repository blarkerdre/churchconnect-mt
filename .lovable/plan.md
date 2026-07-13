# Bible School Application — Signed-in UX + Magic Link Notes

## Goal
When a visitor is already authenticated and opens the public Bible School application form, prefill their identity fields and lock the email so approval always reuses their existing auth account. Keep the magic link lifetime at the default 1 hour.

## Scope

**In scope**
- Public Bible School application form (the page/route that inserts into `wofbi_applications`).
- Prefill logic sourced from the current `useAuth().myMember` / `auth.user` when a session exists.
- Locking the email field for signed-in users (read-only, visually disabled, with a helper hint).

**Out of scope**
- `provision-exam-account` edge function — already idempotent on email; no change needed.
- Magic link expiry — keeping default 1 hour. No `configure_auth` change.
- Admin-side approval / resend flow — unchanged.

## Changes

### 1. Public application form (frontend only)
File: the public Bible School application page (the one linked from the public registration link — likely `src/pages/PublicWoFBIApplication.jsx` or the equivalent under `src/pages/public/`; will confirm exact path on entering build mode).

- Read `useAuth()` at the top of the form.
- If a session exists AND `myMember` resolves for the current tenant:
  - **Prefill on mount** (only when the field is empty, so the user's typing is never overwritten):
    - `full_name` ← `myMember.full_name`
    - `email` ← `auth.user.email`
    - `phone` ← `myMember.phone` (if present)
  - **Lock the email field**: `readOnly`, `disabled` styling, `aria-readonly`, plus a small helper caption under the input: *"Using your signed-in email. Sign out to apply with a different address."*
- If no session: form behaves exactly as today (all fields editable, no prefill).

### 2. No backend / edge function changes
- `provision-exam-account` already: looks up by email → reuses existing `auth.users` row → upserts `members` row → generates fresh magic link. This is the correct behaviour for the locked-email case.
- Magic link stays at Supabase's default **1 hour, single-use**. Admin can resend anytime via the WoFBI Applications tab.

## Technical Details

- `useAuth()` exposes `user` and `myMember`; both may be null on the public page — guard with `if (user && myMember)` before prefilling.
- Prefill runs inside a `useEffect` that depends on `[user?.id, myMember?.id]` and only sets a field when its current value is empty, so React state stays the source of truth after first render.
- Email lock uses the existing shadcn `Input` with `readOnly` + `className="bg-muted cursor-not-allowed"` to match the app's disabled-input pattern.
- No RLS or DB schema change: `wofbi_applications` insert path is untouched.
- Multi-tenant guard: prefill only fires when `myMember.tenant_id === currentTenantId` (avoids leaking a member row from a different tenant into another tenant's application).

## Verification
- Signed-out: form fully editable, submits as before.
- Signed-in same tenant: name/email/phone prefilled, email input is read-only, submit still works and creates a `wofbi_applications` row with the auth email.
- Signed-in different tenant (edge case): no prefill, form behaves like signed-out.
- After approval, `provision-exam-account` reuses the existing user (no duplicate `auth.users` row) and emails a fresh 1-hour magic link.
