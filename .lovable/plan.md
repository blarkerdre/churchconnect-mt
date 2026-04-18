

## Goal
Make the assigned leader's identity and contact info clearly visible to follow-up members in the Sign-Posts timeline, so they know exactly who is shepherding the referred member.

## Current State
The `ReferralTimeline` shows the unit/centre name and a name-only label resolved via `profileMap` ("Leader" fallback). Phone/email of the leader are not shown, and the leader's name is buried in a small subtitle line.

## Plan

### Enhance `ReferralTimeline.jsx`
1. **Fetch leader profiles directly** in this component (instead of relying on `profileMap` which only contains follow-up team members):
   - Collect distinct `assigned_leader_id` values from referrals
   - Query `profiles` table → `user_id, full_name, email, phone, avatar_url`
   - Build a `leaderMap` keyed by `user_id`

2. **Promote leader info to a prominent block** under each referral card:
   - Avatar + leader's full name (bold)
   - Role badge (Unit Leader / Home Cell Leader)
   - Tappable phone (`tel:`) and email (`mailto:`) links — only shown if present
   - For Home Cell referrals, also show centre address/postcode (already partly available via `wsf_centres`)

3. **Layout** (per card):
   ```
   [icon] Target name (Unit / Centre)             [status badge]
          via Sub · dd MMM
   ┌─ Assigned Leader ─────────────────┐
   │ [avatar] Jane Doe                 │
   │  Home Cell Leader                 │
   │  📞 +44... · ✉ jane@...           │
   └───────────────────────────────────┘
   Notes…
   N updates ⌃/⌄
   [Add Update]
   ```

4. **Fallback** if leader profile is missing: show "Leader account not linked" with a muted style instead of a misleading "Leader" label.

### Files Changed
- `src/components/followups/ReferralTimeline.jsx` — add `useQuery` for leader profiles + render new "Assigned Leader" panel (~40 lines added)

No DB changes needed (RLS on `profiles` already lets tenant members read profiles within their tenant).

