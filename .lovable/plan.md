# Duplicate Records Audit

Ran duplicate scans across all people-related tables (members by email / phone / name, children, teens, Bible School applications, course registrations, contacts). All checks were tenant-scoped.

## Findings

### 1. Members — 2 real duplicates + 1 test row (tenant `95e53cc3…`, WCI Cardiff)

**Bintou Jobe** — same person, two profiles (both linked to different auth users):
| Keep? | id | Email | Created | user_id |
|---|---|---|---|---|
| ✅ Keep | `48762388…` | bintoujobe@hotmail.com | 2026-04-12 | c7ec48fc… |
| ❌ Delete | `8507a46f…` | yabinjobe1@gmail.com | 2026-06-18 | c9eeb56e… |

Both share phone `07380397050` and name. Older record is the primary claim; newer looks like a second self-signup with a different email.

**Phone collision `07761364815`** — NOT a duplicate person:
- `fdbba1c4…` — "TEST MEMBER - Do Not Count" (seed/test row)
- `78ecf909…` — Adeniyi Kugbiyi (real member, Bible School)

Proposal: delete the TEST row; leave Adeniyi Kugbiyi. Clear/replace the placeholder phone if you want to keep the test row instead.

### 2. Children — 2 duplicates (tenant WCI Cardiff)

| Child | DOB | Keep (older) | Delete (newer) |
|---|---|---|---|
| Araoluwa Bamidele | 2014-08-29 | `6ddadd5d…` (10:24) | `e012d2ff…` (10:27) |
| Ire Fafowora | 2012-08-18 | `68c3686f…` (Jul 15) | `8258d1e6…` (Jul 23) |

Both duplicates have **no guardians linked and no check-in history**, so deletion is safe (no data merge needed).

### 3. No duplicates found in
- Members by email (case-insensitive)
- Teens
- Bible School applications
- Course registrations
- Contacts

## Proposed cleanup plan

Execute as a single data-cleanup (via insert tool, no schema change):

**Members**
1. Re-parent dependent rows from Bintou `8507a46f…` → `48762388…` across: `event_registrations`, `attendance_records`, `followups.member_id`, `followups.assigned_to`, `pastoral_care.member_id`, `pastoral_care.assigned_to`, `unit_leader_assignments`, `unit_task_assignments`, `child_guardians.member_id`, `sermon_notes`, `member_status_history`, `notifications`, `wofbi_applications.member_id`, `course_registrations`, `training_attendees`, `testimonies`, `announcement_reactions`, `event_reactions`, `messages`, `call_log`, `sms_log`, `email_send_log` (only tables where the FK exists).
2. Detach then delete the stale `auth.users` row `c9eeb56e…` (optional — you may want to keep the login and just null the member link; confirm which).
3. Delete member `8507a46f…`.
4. Delete TEST member `fdbba1c4…`.

**Children**
5. Delete children `e012d2ff…` (Araoluwa) and `8258d1e6…` (Ire) — no dependents.

**Safeguard (optional but recommended)**
6. Add a case-insensitive unique index on `members(tenant_id, lower(email))` (already present per memory) — no change.
7. Add a partial unique index on `children(tenant_id, lower(first_name), lower(last_name), date_of_birth) WHERE archived_at IS NULL` to prevent future duplicate child entries.

## Decisions needed before I run cleanup

1. Bintou Jobe: keep the **older** profile (`48762388…`, hotmail) and drop the newer? Or the reverse?
2. For the dropped Bintou profile's auth user (`c9eeb56e…`): delete the auth account, or keep the login and just unlink?
3. TEST MEMBER row: delete it, or keep and just free the phone number?
4. Proceed with the child-duplicate uniqueness index (item 7)?

Once you confirm, I'll switch to build mode and run the cleanup as one migration + one data change.
