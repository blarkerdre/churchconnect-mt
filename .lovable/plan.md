# Tenant Scoping Hardening

An audit of all pages, components, hooks, and edge functions identified gaps where DB queries are not scoped to the current tenant. The codebase is mostly disciplined (uses `scopeQuery`/`withTenant`), but a small number of files leak across tenants. This plan fixes them.

## CRITICAL — Cross-tenant writes

**1. `supabase/functions/admin-delete-user/index.ts`** — When a super-admin deletes a user, bulk `UPDATE`s on `followups`, `pastoral_care`, `members`, `events`, `attendance_sessions`, `wsf_attendance`, `first_timers`, `announcements`, `transportation`, `app_settings`, and `DELETE`s on `event_registrations`, `unit_leader_assignments`, `notifications`, `audit_log` run with no `tenant_id` filter. For users in multiple tenants this wipes their links/records in every tenant. Fix: look up the user's `tenant_memberships`, then loop the statements per tenant adding `.eq("tenant_id", tenant_id)`.

## HIGH — Cross-tenant reads of sensitive data

**2. `src/components/followups/SignPostDetailPanel.jsx`** — `followup_referrals` and `followup_referral_updates` selects use only `id`/`referral_id`. Add `.eq("tenant_id", tenantId)`.

**3. `src/pages/Communications.jsx`** — `MemberSmsListView` queries `sms_log` by `recipient_member_id` only, and `MemberEmailList` queries `email_send_log` by `recipient_email` only. Add `.eq("tenant_id", tenantId)` to both.

**4. `supabase/functions/grade-exam/index.ts`** — `exam_questions`/`exam_question_answers` fetched by `subject_id`/`training_type` only. A student could be graded against another tenant's bank. Add `.eq("tenant_id", member.tenant_id)`.

## MEDIUM — Missing scoping & realtime leaks

**5. `src/components/attendance/CheckInPanel.jsx`** — `attendance_records` select missing `tenant_id`.

**6. `src/components/sermons/SermonNoteFormDialog.jsx`** — `sermon_notes` UPDATE chain scoped only by `user_id`; add `.eq("tenant_id", tenantId)`.

**7. `src/pages/ExamManagement.jsx`** — `app_settings` SELECTs (lines 903, 963) missing `tenant_id`.

**8. `src/hooks/useAuth.jsx`** — `unit_leader_assignments`, `members`, `wsf_centres` queries run before tenant context exists. Filter by `current_tenant` once known, or move these lookups into `TenantContext` after the tenant resolves so multi-tenant users don't get pollution from other tenants.

**9. `src/components/notifications/NotificationBell.jsx`** — Realtime `notifications` channel filtered only by `user_id`; server delivers cross-tenant rows that are discarded client-side. Switch the channel filter to `tenant_id=eq.${tenantId}` (server side) and verify `user_id` client-side.

**10. `src/hooks/useMessageAlerts.jsx`** — Same pattern as #9 on the `messages` table. Same fix.

**11. `supabase/functions/notify-unit-task-assignment/index.ts`** — `unit_tasks` / `unit_task_assignments` queried by `task_id` only, using service role. Add `.eq("tenant_id", tenant_id)` from the request body and assert the loaded task's tenant matches.

**12. `src/components/unitTasks/UnitTaskDetailPanel.jsx`** — Realtime channels for `unit_task_assignments` and `unit_task_comments` filtered by `task_id` only; add a tenant guard for defence-in-depth.

## LOW — Hardening (optional, batched with the above)

- `src/lib/audit.js`: make `tenantId` required (or pull from context) so audit rows always carry it.
- `src/pages/Communications.jsx`: add `.eq("tenant_id", tenantId)` to the messaging-panel `members` and `wsf_centres` lookups.
- `src/pages/ExamManagement.jsx` (line 991): replace manual `if (tenantId)` guard with `scopeQuery`.
- `src/hooks/useChurchUnits.jsx`: chain `scopeQuery` inline for consistency.

## Technical notes

- All client-side fixes use existing `useTenant()` / `useTenantQuery()` hooks; no new APIs.
- Realtime filter limitation: Supabase Realtime supports one column per `filter` string. Strategy is to filter server-side by `tenant_id` (the higher-cardinality safety boundary) and keep the `user_id`/`task_id` check on the client, since the client-side check is fine when the server-side filter already enforces the tenant boundary.
- No DB migrations required — existing RLS already enforces tenant isolation at the row level; these changes close gaps where the *query shape* (or service-role bypass in edge functions) is the leak surface.
- No UI/UX changes; this is a security/correctness pass.

## Out of scope

- Tables without `tenant_id` (`profiles`, `user_roles`, `tenants`, `tenant_*`, `platform_alerts`, `suppressed_emails`, `email_unsubscribe_tokens`, `push_subscriptions`, `purged_data_archives`, `domifort_api_tokens`).
- Refactoring `scopeQuery`/`withTenant` themselves.
- Adding new RLS policies (existing policies already enforce isolation; this plan fixes the client/edge layer).
