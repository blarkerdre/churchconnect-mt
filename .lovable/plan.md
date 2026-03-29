

## Delete All "Unknown" Followup Records

### What
Delete the 5 followup records where `member_id IS NULL` — these show as "Unknown" in the UI because no member is linked.

### How
One database migration:
```sql
DELETE FROM public.followups WHERE member_id IS NULL;
```

This removes all 5 orphaned records across all tenants. No code changes needed.

