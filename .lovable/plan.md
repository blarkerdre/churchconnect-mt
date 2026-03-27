

## Assign Odunsi's Account: Member Role + Tenant Membership

### What

Two data operations for user `66d26f57-822d-4622-b94f-8273c6a37050` (Odunsi Temitayo Ezekiel, `odunsi.temitayo16@gmail.com`):

1. **Insert `tenant_memberships`** — add membership with role `member` for the `wci-cardiff` tenant
2. **Insert `user_roles`** — add `member` role scoped to the `wci-cardiff` tenant

### SQL (via insert tool)

```sql
-- 1. Tenant membership
INSERT INTO public.tenant_memberships (user_id, tenant_id, role)
VALUES (
  '66d26f57-822d-4622-b94f-8273c6a37050',
  (SELECT id FROM public.tenants WHERE slug = 'wci-cardiff'),
  'member'
)
ON CONFLICT DO NOTHING;

-- 2. User role
INSERT INTO public.user_roles (user_id, role, tenant_id)
VALUES (
  '66d26f57-822d-4622-b94f-8273c6a37050',
  'member',
  (SELECT id FROM public.tenants WHERE slug = 'wci-cardiff')
)
ON CONFLICT (user_id, role) DO NOTHING;
```

### Files changed

None — data-only operations.

