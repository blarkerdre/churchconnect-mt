
Issue:
The update is not publishing because `src/pages/SystemLogs.jsx` imports three files under `src/components/logs/`, and the build worker repeatedly fails to load those paths during publish. Since this has already failed across multiple rebuild attempts, this is not a reliable “cache only” problem anymore. The safe fix is to remove those fragile imports from the build path.

Do I know what the issue is?
Yes. The publish build is breaking on these imported modules:
- `@/components/logs/EmailLogsTab.jsx`
- `@/components/logs/SMSLogsTab.jsx`
- `@/components/logs/AuditLogsTab.jsx`

Even though they appear in the editor, the builder is not resolving them consistently. So the fix should avoid depending on those files at all.

Plan to fix publish:

1. Collapse the log tabs into `src/pages/SystemLogs.jsx`
- Move the Email, SMS, and Audit tab component logic directly into `SystemLogs.jsx` as local components in the same file.
- Keep the current tabbed UI and role behavior unchanged.
- This removes the failing imports entirely.

2. Reuse existing working logic
- Copy/adapt:
  - email log logic from `src/pages/EmailDashboard.jsx`
  - SMS log logic from `src/components/sms/SMSHistoryDialog.jsx`
  - audit log logic from `src/pages/AuditLog.jsx`
- Preserve filters, badges, pagination, and admin/super-admin access rules.

3. Keep routing/navigation unchanged
- Leave `/system-logs` in `src/App.jsx`
- Leave the “System Logs” sidebar item in `src/components/AppLayout.jsx`
- No user-facing navigation changes needed.

4. Clean up the unstable dependency path
- After `SystemLogs.jsx` is self-contained, remove imports of `@/components/logs/*`.
- The separate `src/components/logs/` files can then be left unused or removed in a follow-up cleanup, but they will no longer block publishing.

Files involved:
- `src/pages/SystemLogs.jsx` — make self-contained with all three tab panels
- `src/App.jsx` — likely no logic change, just verify route still points to `SystemLogs`
- `src/components/AppLayout.jsx` — likely no logic change, just verify nav item
- Optional cleanup later:
  - `src/components/logs/EmailLogsTab.jsx`
  - `src/components/logs/SMSLogsTab.jsx`
  - `src/components/logs/AuditLogsTab.jsx`

Expected result:
Publishing should work again because the build will no longer rely on the unresolved `src/components/logs/*` module paths.
