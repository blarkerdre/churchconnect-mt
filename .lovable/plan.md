

## Plan: Lock down remaining tenant-scoping gaps

After auditing all client-side queries and edge functions, the codebase is already well-scoped via `useTenantQuery`. There are 8 specific gaps where mutations target a row by `id` only (no `.eq("tenant_id", tenantId)` guard). RLS already protects most of these, but defense-in-depth requires explicit guards per the project rule.

### Client-side gaps (8 mutations to fix)

| # | File | Line | Issue |
|---|---|---|---|
| 1 | `src/pages/ExamManagement.jsx` | 241 | `exam_titles` toggle — update by id only |
| 2 | `src/components/exams/ExamSessionManager.jsx` | 111 | `exam_sessions` update by id only |
| 3 | `src/components/profile/MemberFeed.jsx` | 45 | `announcement_reactions` delete by id only |
| 4 | `src/components/profile/MemberFeed.jsx` | 141 | `event_reactions` delete by id only |
| 5 | `src/components/users/WSFLeaderAssignments.jsx` | 61 | `wsf_centres` update leader by id only |
| 6 | `src/components/users/WSFLeaderAssignments.jsx` | 76 | `wsf_centres` clear leader by id only |
| 7 | `src/components/tenants/TenantBillingTab.jsx` | 58 | `tenant_subscriptions` update — needs `.eq("tenant_id", tenantId)` |
| 8 | `src/components/tenants/TenantBillingTab.jsx` | 96 | `tenants` update by id — already targets a tenant id, leave as-is (super-admin scope) |

For each, append `.eq("tenant_id", tenantId)` so a misrouted id can never write across tenants.

### Intentionally NOT changed
- `src/pages/TenantAdmin.jsx` `tenants.update` — Super-Admin cross-tenant tool (per `mem://architecture/tenant-scoping-exceptions`).
- `src/pages/SermonNotes.jsx` `sermon_notes` delete — already scoped by `user_id = auth.uid()`, which is stronger than tenant_id.

### Edge-function review
- `twilio-webhook`, `handle-email-suppression`, `handle-email-unsubscribe`, `admin-delete-user` correctly look up rows by globally-unique provider IDs / auth user IDs. They don't need tenant guards — adding them would break webhook delivery (Twilio doesn't know our tenant). **No changes.**
- `notify-join-request` (just fixed for unsubscribe tokens) and `refresh-sms-status` (newly added) already filter by `tenant_id` from the validated payload.
- All `notify-*` / `send-*` functions: already pass `tenant_id` and filter their queries by it.

### System Logs page (already scoped — no changes)
All five tabs (Email, SMS, WhatsApp, Calls, Audit) already use `scopeQuery(...)` from `useTenantQuery`. Verified.

### Files
**Edit**
- `src/pages/ExamManagement.jsx`
- `src/components/exams/ExamSessionManager.jsx`
- `src/components/profile/MemberFeed.jsx`
- `src/components/users/WSFLeaderAssignments.jsx`
- `src/components/tenants/TenantBillingTab.jsx`

### Out of scope
- Refactoring all queries to use `scopeQuery` everywhere (only adding the missing guards).
- Changing RLS policies — current policies already enforce isolation; this adds belt-and-braces at the query layer.

