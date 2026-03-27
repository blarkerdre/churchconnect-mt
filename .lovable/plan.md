

## Fix: Tenant-Scope Pickup Locations RLS Policy

### Problem

The `pickup_locations` table has a duplicate policy `"Admins/leaders can manage pickup locations"` that uses the **single-argument** `is_admin(auth.uid())` and `has_role(auth.uid(), 'unit_leader')` — no tenant filter. Any admin/leader from any tenant can manage all pickup locations.

There's already a correct tenant-scoped policy `"Admins can manage pickup locations"` using `is_admin(auth.uid(), tenant_id)`.

### Fix

Drop the insecure duplicate policy and replace it with a tenant-scoped version that also includes unit leaders:

```sql
DROP POLICY IF EXISTS "Admins/leaders can manage pickup locations" ON public.pickup_locations;

CREATE POLICY "Admins/leaders can manage pickup locations"
ON public.pickup_locations
FOR ALL
TO authenticated
USING (is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id))
WITH CHECK (is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id));
```

### Files changed

- **One database migration** — drop and recreate the policy with tenant-scoped functions

