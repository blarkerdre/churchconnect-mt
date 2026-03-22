

## Plan: Form Restructuring, Events Overhaul, and Prayer Request Routing

This is a large set of changes spanning forms, events, notifications, and automated workflows. Breaking into sections:

---

### 1. Form Changes (PublicRegistration, MemberFormDialog, MyProfile)

**All 3 forms** get these changes:

| Change | Detail |
|--------|--------|
| Remove WIT | Delete the "Workers in Training" switch from all forms and stop sending `workers_in_training` in payloads |
| Group BCC/LCC/LDC | Place under a sub-heading: **"Word of Faith Bible Institute - WoFBI"** |
| Conditional sections | When status is "New Convert", "First Timer", or "Visitor": hide Church Units and Spiritual Development (BFC, WSF, WoFBI courses). Only show Water Baptism + Holy Spirit Baptism for First Timer/New Convert |
| Emergency contact | Show for ALL statuses (remove the conditional wrap in PublicRegistration) |

**Conditional visibility logic:**
```text
Status = Active/Inactive → Show: Church Units, full Spiritual Development (WSF, BFC, WoFBI)
Status = First Timer/New Convert → Show: Water Baptism, Holy Spirit Baptism. Hide: Church Units, WSF, BFC, WoFBI
Status = Visitor → Hide: Church Units, Water Baptism, HS Baptism, WSF, BFC, WoFBI (show nothing extra)
```

**Files**: `PublicRegistration.jsx`, `MemberFormDialog.jsx`, `MyProfile.jsx` (both editing and CreateMemberProfile sections)

---

### 2. Events Overhaul

**Database migration:**
- Add `event_mode` column (text, default `'In Person'`) to `events` table — values: "In Person", "Online", "Hybrid"
- Add `end_time` already exists in schema
- Add `target_unit` column (text, nullable) — for unit-specific events
- Add `target_wsf_centre_id` column (uuid, nullable) — for WSF centre-specific events
- Remove capacity from the event form UI (keep column in DB for backward compat)

**Events page (`Events.jsx`) changes:**
- Replace Capacity input with Event Mode select (In Person / Online / Hybrid)
- Add end time field alongside start time
- Display event mode badge on event cards
- Unit leaders: auto-set `target_unit` to their assigned unit when creating events, filter event list to show their unit's events + general events
- WSF leaders: auto-set `target_wsf_centre_id` to their centre, filter to show their centre's events + general events
- Update save mutation payload to include `event_mode`, `end_time`, `target_unit`, `target_wsf_centre_id`

**EventFormDialog.jsx** — same changes if this dialog is used elsewhere

**Communications scoping** — Unit leaders and WSF leaders can create unit/centre-specific announcements and SMS (already partially supported via `target_audience` on announcements)

---

### 3. WSF Leader Notification on New Registration

When a new member registers with a WSF centre (or near one), notify the WSF leader of that centre.

**Implementation**: Update the `public-register` edge function to:
- After inserting/updating a member with a `wsf_centre_id`, look up the WSF centre's `leader_id`
- Find the leader's `user_id` from the `members` table
- Insert a notification for that user: "New member registered near your WSF centre: [name]"

---

### 4. Prayer Request → Pastoral Care + Follow-up

When a prayer request (notes field) is submitted via public registration or member form:

**Update `public-register/index.ts`:**
- After member insert/update, if `notes` is non-empty:
  - Create a `pastoral_care` record with `care_type: 'Prayer Request'`, `subject: 'Prayer Request from [name]'`, `description: notes`
  - Need to check if `'Prayer Request'` exists in the `pastoral_care_type` enum; if not, add it via migration
  - Assign to a Pastoral Care unit member using the same least-busy round-robin pattern as follow-ups

**Update `auto_create_followup` trigger:**
- Currently only fires for First Timer / New Convert
- Add logic: if `notes` is not null/empty on INSERT, include the prayer request text in the follow-up description so the follow-up team is aware

**Database migration:**
- Add `'Prayer Request'` to `pastoral_care_type` enum if not already present

---

### 5. Database Migration Summary

```sql
-- Events: add event_mode, target_unit, target_wsf_centre_id
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS event_mode text NOT NULL DEFAULT 'In Person';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS target_unit text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS target_wsf_centre_id uuid;

-- Pastoral care type enum: add Prayer Request
ALTER TYPE public.pastoral_care_type ADD VALUE IF NOT EXISTS 'Prayer Request';
```

---

### 6. Files Changed Summary

| File | Changes |
|------|---------|
| `PublicRegistration.jsx` | Conditional sections, remove WIT, WoFBI heading, emergency contact for all, prayer request routing via edge function |
| `MemberFormDialog.jsx` | Same form restructuring, remove WIT, WoFBI heading, conditional visibility |
| `MyProfile.jsx` | Same (both edit mode and CreateMemberProfile), remove WIT from RPC call |
| `Events.jsx` | Remove capacity, add event mode, end time, unit/centre scoping for leaders |
| `EventFormDialog.jsx` | Same event form changes |
| `public-register/index.ts` | Remove `workers_in_training`, add pastoral care creation for prayer requests, WSF leader notification |
| `auto_create_followup` trigger | Include prayer request in follow-up description |
| DB migration | New columns on events, new enum value on pastoral_care_type |
| `update_own_member_profile` RPC | Remove `_workers_in_training` parameter |

### Technical Notes
- The `workers_in_training` column stays in the DB but is no longer exposed in forms
- Event mode is a text column (not enum) for flexibility
- WSF leader notifications are created inline in the edge function (fire-and-forget style)
- Prayer request pastoral care records are created with service role in the edge function

