## Goal
Make the SLA that tenant owners download and sign match the attached `ChurchConnect_SLA.docx` verbatim, with DomiFort Solutions Limited retained as the Service Provider (per earlier decision).

## Findings
- `src/lib/sla.js` `DEFAULT_SLA_BODY` already mirrors the attached document's 18 sections (parties, definitions, availability 99.5%, P1/P2/P3 severity table, retention 30 days, England & Wales, etc.), with `{{tenant_name}}`, `{{owner_name}}`, `{{owner_email}}`, `{{effective_date}}`, `{{plan_name}}` merge tokens woven in.
- The `sla_templates` table was seeded once from an earlier migration. That seeded row is what tenant owners currently see — not the updated code default — because `SLASection` loads the active DB row and falls back to `DEFAULT_SLA_BODY` only when none exists.
- Net effect: the attached document's wording is already in the codebase, but the DB template shown in Tenant Admin → Billing may still be the older seed.

## Change
Insert a new active `sla_templates` row containing the full attached SLA body. The existing `sla_templates_before_insert` trigger auto-increments the version and deactivates the previous row, so this becomes the single active template.

### Migration (single statement)
```sql
INSERT INTO public.sla_templates (title, body, is_active, notes)
VALUES (
  'ChurchConnect — Service Level Agreement',
  '<full HTML body matching src/lib/sla.js DEFAULT_SLA_BODY>',
  true,
  'Adopted from ChurchConnect_SLA.docx v1.0 (attached). DomiFort Solutions Limited retained as Service Provider.'
);
```
The HTML body is taken verbatim from `DEFAULT_SLA_BODY` so the download PDF, the on-screen preview, and the signature payload all reference the same text.

## Not changing
- No schema changes.
- No UI changes to `SLASection`, `SLATemplateAdmin`, or the type-to-sign flow.
- Existing signatures in `tenant_sla_signatures` are preserved and remain bound to the version they signed against.

## Verification
1. Open Tenant Admin → Billing → SLA as a tenant owner.
2. Confirm the preview renders the 18 sections from the attached doc with the tenant's name, owner, date, and plan filled in.
3. Click "Download PDF" and spot-check §1 parties, §6.2 severity table, §10 retention (30 days), §16 governing law (England & Wales), §18 signature block.
4. Sign; confirm the row lands in `tenant_sla_signatures` with the new template version.
