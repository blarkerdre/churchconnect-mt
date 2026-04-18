

## Goal

Let Follow-up team members refer (sign-post) First Timers, New Converts, and Visitors to:
1. A **Unit Leader** (member chooses which church unit)
2. A **Home Cell leader** (system suggests the closest centre by postcode/address; user can override)

Then receive **progress reports** back from those leaders inside the same follow-up record.

## Design

### 1. New table: `followup_referrals`
Tracks each sign-post and its progress thread.
- `id`, `tenant_id`, `followup_id`, `member_id`
- `referral_type` — `unit_leader` | `home_cell_leader`
- `target_unit_name` (text, when type = unit_leader)
- `target_wsf_centre_id` (uuid, when type = home_cell_leader)
- `assigned_leader_id` (uuid → resolved automatically from the unit/centre)
- `status` — `pending` | `contacted` | `engaged` | `joined` | `declined` | `closed`
- `referred_by`, `notes`, `created_at`, `updated_at`

**Plus `followup_referral_updates`** — a thread of progress reports from the assigned leader:
- `id`, `tenant_id`, `referral_id`, `author_id`, `update_text`, `status_change` (nullable), `created_at`

### 2. RLS
- `followup_referrals` & `_updates` — readable by: admins, follow-up team members (creator), AND the assigned leader (so they can update). Insert/update by admins, follow-up creators, or the assigned leader.

### 3. UI changes — `FollowupDetailPanel.jsx`
For follow-ups where category is **First Timer / New Convert** (or status is Visitor), add a new **"Sign-Post"** section with two buttons:
- **Refer to Unit Leader** → opens dialog: choose unit (from `church_units`), system shows leaders for that unit (`unit_leader_assignments` filtered by `unit_name`), pick one, add note → creates referral.
- **Refer to Home Cell Leader** → opens dialog: pre-suggests closest centre using existing `suggestClosestWSFCentre()` against the member's postcode/address; user can change centre; assigned leader auto-resolves from `wsf_centres.leader_id`; add note → creates referral.

Below the buttons, show a **Referrals timeline**: each referral card shows target (unit name or centre name + location), assigned leader, current status, and an inline thread of `followup_referral_updates`. The Follow-up team member can read updates here.

### 4. New page section / leader inbox
On the leader's **Dashboard** (Unit Leader Dashboard / Home Cell Leader Dashboard), add a "Sign-Posted to You" widget listing pending referrals where `assigned_leader_id = auth.uid()`. Click → dialog where leader can:
- Add a progress update (free text)
- Change the referral status (contacted / engaged / joined / declined / closed)
The update is appended to `followup_referral_updates`; status change is mirrored on `followup_referrals.status`.

### 5. Notifications
On referral creation: send an in-app notification + email (using existing `notifications` system + `send-transactional-email`) to the assigned leader. On each leader update: notify the original `referred_by` user so the Follow-up team sees progress.

### 6. Closest-leader logic
- Unit referral: member picks the unit explicitly (no proximity).
- Home Cell referral: reuse `src/lib/wsf-suggest.js` (`suggestClosestWSFCentre`) — already scores by `coverage_postcodes`, postcode, city, address. Pre-fills the centre dropdown but allows override.

## Files Changed

- **New migration**: `followup_referrals` + `followup_referral_updates` tables, RLS, updated_at triggers
- **New** `src/components/followups/SignPostDialog.jsx` — unit/centre picker + leader resolution
- **New** `src/components/followups/ReferralTimeline.jsx` — list of referrals with inline update thread
- **New** `src/components/followups/ReferralUpdateDialog.jsx` — leader's update form
- **New** `src/components/dashboard/SignPostedToMeWidget.jsx` — widget for unit/home-cell leaders
- **Edit** `src/components/followups/FollowupDetailPanel.jsx` — add Sign-Post section + ReferralTimeline (~40 lines)
- **Edit** `src/components/dashboard/MemberDashboard.jsx` (or the leader dashboards) — mount `SignPostedToMeWidget` for users with `unit_leader` or `wsf_leader` roles
- **New** edge function (or reuse `notify-unit-leader` / `notify-wsf-leader` patterns) — `notify-signpost` for assignment + update notifications

## Assumptions (correct me if wrong)
- Visitors are tracked as members with `membership_status = 'Visitor'` (already supported).
- Unit referral assigns to **one** chosen leader (if a unit has multiple leaders, the user picks from the list).
- Closing a referral does **not** auto-complete the parent follow-up — Follow-up team decides separately.
- Notifications go via existing in-app + email channels, not SMS (to keep cost neutral).

