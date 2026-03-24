

# Phase 1.1: Tenant Foundation Tables

## What We're Building
Create the core multi-tenant database tables and helper functions that all future phases depend on. The existing app continues working unchanged.

## Step 1: Create `tenants` Table
- `id` (uuid PK), `name` (text), `slug` (text, unique), `logo_url` (text), `timezone` (text, default 'Europe/London'), `settings` (jsonb for branding/features), `setup_complete` (boolean, default false), `created_by` (uuid), `created_at`, `updated_at`
- RLS: authenticated users can read tenants they belong to; service role for creation

## Step 2: Create `tenant_memberships` Table
- `id` (uuid PK), `tenant_id` (uuid FK → tenants), `user_id` (uuid FK → auth.users), `role` (text: 'owner', 'admin', 'member'), `created_at`
- Unique constraint on (user_id, tenant_id)
- RLS: users can read own memberships; tenant owners/admins can manage

## Step 3: Create Helper Functions
- `user_belongs_to_tenant(uuid, uuid)` — checks tenant_memberships, SECURITY DEFINER
- `is_tenant_admin(uuid, uuid)` — checks if user has 'owner' or 'admin' role in tenant_memberships, SECURITY DEFINER

## Step 4: Create Default Tenant & Backfill
- Insert a default tenant row for "Winners Chapel International Cardiff" with slug `wci-cardiff`
- Insert `tenant_memberships` for all existing users with `user_roles` entries, mapping: super_admin/admin → 'admin', others → 'member'; the first super_admin becomes 'owner'

## Step 5: Add `tenant_id` to Core Tables (Batch A)
Add nullable `tenant_id uuid REFERENCES tenants(id)` column + index to:
- `members`, `profiles`, `user_roles`, `followups`, `pastoral_care`, `notifications`, `messages`
- Backfill all existing rows with the default tenant ID

## What Stays the Same
- All existing queries, RLS policies, and edge functions remain unchanged
- `tenant_id` columns are nullable so current inserts still work
- No frontend changes in this phase

## Technical Details

Migration SQL outline:

```text
Migration 1: tenants + tenant_memberships tables + RLS + helper functions
Migration 2: Default tenant insert + membership backfill
Migration 3: Add tenant_id to Batch A tables + backfill
```

Each migration is additive only — no columns dropped, no policies changed, no breaking changes.

