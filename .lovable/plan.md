

## Extend Follow-up Auto-Assignment to Include Unit Members

### What
1. **Extend the DB trigger** (`auto_create_followup`) to include regular Follow-up unit members (from `members.church_unit`) in the auto-assignment pool, alongside unit leaders
2. **Extend the reassignment dropdown** to include both unit leaders AND regular Follow-up unit members
3. **Allow unit leaders to reassign** (currently only admins can)

### Database Migration

Update the `auto_create_followup()` trigger function to build a combined assignment pool:

```sql
-- Current: only queries unit_leader_assignments
-- New: UNION with members whose church_unit contains 'Follow-up' and who have a user_id
SELECT user_id FROM (
  -- Unit leaders
  SELECT ula.user_id FROM unit_leader_assignments ula
  WHERE ula.unit_name IN ('Follow-up','Follow-Up','follow-up')
    AND (NEW.tenant_id IS NULL OR ula.tenant_id = NEW.tenant_id)
  UNION
  -- Regular unit members
  SELECT m.user_id FROM members m
  WHERE m.user_id IS NOT NULL
    AND m.tenant_id = NEW.tenant_id
    AND (lower(m.church_unit) LIKE '%follow-up%' OR lower(m.church_unit) LIKE '%follow up%')
) pool
ORDER BY (SELECT COUNT(*) FROM followups f WHERE f.assigned_to = pool.user_id AND f.status IN ('Pending','In Progress')) ASC, random()
LIMIT 1;
```

Also update the notification loop to notify both leaders AND unit members.

### Code Changes

#### 1. `src/pages/Followups.jsx` — expand `followupUnitMembers` query
- Current: only fetches from `unit_leader_assignments`
- New: also fetch members whose `church_unit` contains "Follow-up" and have a `user_id`, merge both sets into a deduplicated list
- Pass `isUnitLeader` to `FollowupDetailPanel`

#### 2. `src/components/followups/FollowupDetailPanel.jsx` — allow unit leaders to reassign
- Line 201: change `{isAdmin && ...}` to `{(isAdmin || isUnitLeader) && ...}`
- Accept `isUnitLeader` prop

### Files changed
1. **1 database migration** — update `auto_create_followup()` function
2. **`src/pages/Followups.jsx`** — expand followup unit members query + pass `isUnitLeader`
3. **`src/components/followups/FollowupDetailPanel.jsx`** — allow unit leaders to reassign

