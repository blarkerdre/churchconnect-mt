## Restrict Consent & API to owners; keep Certificates for admins

### `src/pages/Settings.jsx`

Tab triggers (~lines 1595–1596): wrap both with `{canOwnerOnly && (...)}`:
- `consent` trigger → owner/super-admin only
- `api` trigger → owner/super-admin only

Tab content (~lines 1691–1697): wrap both `<TabsContent value="consent">` and `<TabsContent value="api">` with `{canOwnerOnly && (...)}`.

Certificates: no change — it stays gated by `canManageTenant` (owner + admin + super-admin) so admins keep access to certificate template configuration and certificate generation flows (issuing is invoked from member dialogs and is unaffected).

### Permission matrix update

```text
Capability             Owner   Admin   SuperAdmin
─────────────────────────────────────────────────
Consent & Privacy tab    ✓       ✗        ✓
API Keys tab             ✓       ✗        ✓
Certificates tab         ✓       ✓        ✓
Issue certificate        ✓       ✓        ✓
```

No DB / RLS / backend changes — UI gating only, reusing existing `canOwnerOnly` from the prior owner-vs-admin separation.