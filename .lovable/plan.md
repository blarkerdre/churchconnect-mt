

## Harden tenant guards in the Milestone Report flow

The Milestone Report and its messaging dialog are already tenant-scoped via RLS and the `useTenantQuery` helper, but the guards are **implicit** — `scopeQuery` silently no-ops if `tenantId` is null, and the messaging dialog will happily build payloads with `tenant_id: null` and let the server reject them. This change makes every query, insert, and edge-function call **fail closed** when no tenant is resolved, and replaces every implicit `scopeQuery` call with an explicit `.eq("tenant_id", tenantId)` for defense in depth.

### Files & changes

#### 1. `src/components/analytics/MemberMilestoneReport.jsx`

Replace both `scopeQuery(...)` query bodies with explicit `.eq("tenant_id", tenantId)` and add a runtime guard.

```js
// members query
queryFn: async () => {
  if (!tenantId) throw new Error("No tenant context");
  const { data, error } = await supabase
    .from("members")
    .select("*")
    .eq("tenant_id", tenantId);
  ...
}

// wsf_centres query — same pattern
.from("wsf_centres").select("id, name, is_active").eq("tenant_id", tenantId).order("name")
```

`scopeQuery` import can be dropped; keep `tenantId`. The `enabled: !!tenantId` flag stays.

#### 2. `src/components/analytics/MessageFilteredMembersDialog.jsx`

Add an early guard at the top of each send handler — `sendEmail`, `sendSmsLike`, `sendInApp`:

```js
if (!tenantId) {
  toast({ title: "No church context", description: "Reload the page and try again.", variant: "destructive" });
  return;
}
```

For the in-app `notifications` insert, also add a defensive `.eq("tenant_id", tenantId)` is N/A on insert — but include a per-row sanity check that every row's `tenant_id` matches the resolved `tenantId` before insert (single line: `if (rows.some(r => r.tenant_id !== tenantId)) throw new Error("Tenant mismatch")`).

For the SMS/email edge function calls: no body change needed beyond the early guard, since both already pass `tenant_id: tenantId`.

#### 3. (Optional, kept in scope) — disable the report's roster/message buttons when `tenantId` is missing

Add `disabled={!tenantId || …existing}` to:
- Export CSV
- Print Report
- Message Members
- Download / Message Unit Members
- Download / Message Centre Members

This way the UI never even tries to act on a tenantless context.

### Acceptance checks

1. Loading the Milestone Report when `tenantId` resolves: behaves exactly as today (members + centres load, filters, exports, and messaging all work).
2. If `tenantId` is null (e.g. during tenant-switch race): queries don't fire (existing `enabled` flag), and all roster/message/export buttons are disabled.
3. Calling any send handler in the message dialog with no tenant resolved shows a "No church context" toast and aborts before any network call.
4. Both Supabase queries in the report visibly include `.eq("tenant_id", tenantId)` in source — no implicit `scopeQuery` indirection.
5. Bulk in-app insert refuses to run if any row's `tenant_id` doesn't match the resolved tenant (guards against a future refactor regression).
6. CSV exports, print report, and audit-log payloads are unchanged in shape.

