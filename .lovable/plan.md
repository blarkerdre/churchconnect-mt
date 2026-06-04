# Restrict Certificate Issuance

Limit who can issue / reissue training certificates to **admins** and **unit leaders specifically assigned to the "Training Rep" unit**. Other unit leaders lose the ability they currently have.

## Backend — `supabase/functions/issue-certificate/index.ts`

Replace the current "admin OR any unit_leader" gate with:

1. Admin in this tenant → allowed.
2. Otherwise: caller must have `unit_leader` role in this tenant **AND** a row in `unit_leader_assignments` with `unit_name ILIKE 'Training Rep'` for `user_id = caller` and `tenant_id = tenant_id`.
3. Anyone else → 403 Forbidden (message: "Only admins and the Training Rep unit leader can issue certificates").

Applies to both initial issue and reissue (same code path / same gate).

## Frontend gating

- `src/pages/Members.jsx`: the "Issue Certificate" dropdown item currently shows for `isAdmin` only. Change to show for `isAdmin || (isUnitLeader && leaderUnits.some(u => u.toLowerCase() === 'training rep'))`. `leaderUnits` is already provided by `useAuth`.
- `src/components/certificates/IssueCertificateDialog.jsx`: no role logic lives here today; the new gate at the call site is sufficient. The Reissue button inside the dialog stays as-is (only users who can open the dialog can press it).

## Out of scope

- No DB migration / no new RLS policy on `training_completions` (the edge function is the single write path and runs with service role).
- No changes to certificate template settings, MyCertificates view, or exam-driven auto-issuance (server-to-server call from `grade-exam` already uses the service-role bearer, which bypasses this user-level check).
- "Training Rep" unit name is matched case-insensitively but is otherwise hard-coded — no admin UI to change it.
