

## Fix: Drop All `update_own_member_profile` Overloads, Create Single Canonical Function

The previous migration failed to drop all overloads because it didn't match exact signatures. There are still **3 overlapping overloads** (15-param, 25-param with enum types, 25-param with text, 34-param with enum, 35-param with text+worshipped_at_other_wci).

### Fix

**1 new migration** that:
- Drops all overloads by exact signature (including the 15-param, 24-param, 25-param with `_workers_in_training`, the enum-typed 34-param, and the text-typed 35-param versions)
- Creates one single function with all 35 parameters using `text` types for `_gender` and `_membership_status` (with safe casting inside the body)
- Includes `_worshipped_at_other_wci` as the last parameter

No client-side changes needed — `MyProfile.jsx` already sends the correct parameter set.

### Technical detail — exact DROP statements

```sql
DROP FUNCTION IF EXISTS public.update_own_member_profile(uuid,text,text,text,text,text,text,text,date,text,text,text,text,text,text);
DROP FUNCTION IF EXISTS public.update_own_member_profile(uuid,text,text,text,text,text,text,text,date,text,text,text,text,text,text,text,boolean,boolean,boolean,uuid,boolean,boolean,boolean,boolean,boolean);
DROP FUNCTION IF EXISTS public.update_own_member_profile(uuid,text,text,text,text,text,text,text,date,public.gender_type,text,text,text,text,public.membership_status,text,boolean,boolean,boolean,uuid,boolean,boolean,boolean,boolean,boolean,boolean,text,boolean,boolean,text,boolean,text,boolean,text);
DROP FUNCTION IF EXISTS public.update_own_member_profile(uuid,text,text,text,text,text,text,text,date,text,text,text,text,text,text,text,boolean,boolean,boolean,uuid,boolean,boolean,boolean,boolean,boolean,boolean,text,boolean,boolean,text,boolean,text,boolean,text);
DROP FUNCTION IF EXISTS public.update_own_member_profile(uuid,text,text,text,text,text,text,text,date,text,text,text,text,text,text,text,boolean,boolean,boolean,uuid,boolean,boolean,boolean,boolean,boolean,boolean,text,boolean,boolean,text,boolean,text,boolean,text,boolean);
```

Then CREATE OR REPLACE the single canonical 35-param version.

### Files changed
- 1 new migration — drop all overloads, create single canonical function

