
Issue found

- The preview and live databases are not actually the same: the current Test backend has 10 member records and 30 audit logs, while Live has 3 member records and 167 audit logs.
- Recent member names also do not match between those two datasets.
- The real problem is that the preview runtime is calling a different backend API host than the one attached to this project context, which explains why you can see unexpected member names and audit entries in preview.
- I also checked the codebase: there is no hardcoded alternate backend URL in the app logic, and there is no service worker/offline cache code forcing stale data.

Plan

1. Add a clear environment indicator
- Show an obvious “Preview / Test” or “Live” badge in the app layout for admins.
- Include the current runtime backend target in a small diagnostics section so you can instantly see which backend the app is using.

2. Add a runtime mismatch warning
- Create a small helper that compares the current app hostname with the configured backend target.
- If the app is running on a preview URL but appears to be connected to an unexpected backend, show a warning banner instead of silently loading misleading data.

3. Keep the existing data access rules
- No database schema or RLS changes are planned right now.
- I reviewed the member and audit access rules, and they do not explain cross-environment data appearing in preview.

4. Re-verify preview vs live after the UI diagnostics are added
- Confirm preview points to the Test backend.
- Confirm the published site points to Live.
- Recheck a few recent member and audit records to make sure both environments clearly differ.

Technical details

- Likely files: `src/components/AppLayout.jsx` plus a small new utility/hook, and optionally an admin diagnostics block in `src/pages/SystemLogs.jsx` or `src/pages/Settings.jsx`.
- No backend migrations are needed for this fix.
- If the diagnostics still show preview targeting the wrong backend after rebuild, that would confirm a project-level environment wiring problem rather than an application-code bug.
