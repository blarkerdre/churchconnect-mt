## Life Events in Pastoral Care

Adds a structured workflow for members to notify leaders of significant life events (childbirth, naming/dedication, marriage, bereavement) and optionally request a pastor's presence. Reuses the existing Pastoral Care list — life events appear alongside regular cases with a distinct badge and a multi-stage approval flow.

### Flow

```text
Member submits Life Event request
        │  (picks recipient: Home Cell Leader, Unit Leader, or both)
        ▼
Stage 1: First-line approval (Home Cell Leader / Unit Leader)
        │  approve → notify Altar Ministry; reject → notify member
        ▼
Stage 2: Visible to all Altar Ministry members (read-only)
        │
        ▼
Stage 3: Altar Ministry Unit Leader → final approval
         · assigns/reassigns one Altar Ministry team owner
         · assigns/reassigns one or more pastors
         · notifies member with names of assigned pastors
        ▼
Stage 4: Event occurs → assignee or leader marks Completed
```

### What the user sees

1. **New Request dialog** — adds a "Life Event" option to the type picker. When chosen, additional fields appear:
   - Life event subtype: Childbirth / Naming or Dedication / Marriage / Bereavement
   - Name of child or individual involved
   - Event date
   - "Request a pastor's presence" checkbox
   - Send approval request to: Home Cell Leader, Unit Leader, or Both (checkboxes; auto-resolved from member record)

2. **Pastoral Care list** — life-event cards show a "Life Event" badge, the subtype, event date, current approval stage, and the assigned pastors (once set). Stage filter chips: *Awaiting Leader*, *Awaiting Altar Ministry*, *Approved*, *Completed*, *Rejected*.

3. **Stage 1 action panel** (visible only to the recipient Home Cell/Unit Leader): Approve / Reject with optional note.

4. **Altar Ministry view**: Members of the configured Altar Ministry unit see all stage-2+ life events read-only. The Altar Ministry Unit Leader sees an additional "Final Approve & Assign" action that opens an assignment dialog (team owner + multi-select pastors from Altar Ministry members).

5. **Mark Completed** button on approved events, available to the assigned team owner or any Altar Ministry leader.

6. **Member notifications** at every transition: leader-approved, leader-rejected, final-approved with assigned pastors, completed. In-app notification + email via existing channels.

7. **Settings → Pastoral Care**: Super Admin / tenant admin picks which church unit acts as the *Altar Ministry* (dropdown of existing units, stored in `app_settings`).

### Out of scope
- Calendar/event creation
- SMS/WhatsApp delivery (uses existing in-app + email only)
- Editing a life event after submission (only stage transitions)

---

### Technical notes

**DB (single migration)**
- New table `public.life_event_requests` (tenant-scoped):
  - `id`, `tenant_id`, `pastoral_care_id` (FK to `pastoral_care` — life events still live in the existing list)
  - `subtype` enum: `childbirth | naming_dedication | marriage | bereavement`
  - `subject_name` text (child/person involved)
  - `event_date` date
  - `pastor_requested` bool
  - `approval_route` text[] (`home_cell_leader`, `unit_leader`)
  - `stage` enum: `awaiting_leader | awaiting_altar_ministry | approved | rejected | completed`
  - `stage1_approved_by`, `stage1_approved_at`, `stage1_note`
  - `final_approved_by`, `final_approved_at`
  - `assigned_owner_id` (uuid, an Altar Ministry member's `user_id`)
  - `assigned_pastor_ids` uuid[]
  - `completed_at`, `completed_by`
  - timestamps
- Extend existing `pastoral_care_type` enum with `'Life Event'` (or add `'Childbirth' | 'Naming/Dedication'` mapped via subtype — going with `'Life Event'` + subtype column for cleanliness).
- GRANT to `authenticated` and `service_role`; enable RLS.
- RLS policies (use `user_has_tenant_access` + `has_role` helpers already in project):
  - INSERT: any authenticated tenant member for their own request.
  - SELECT: creator; assigned routes' leaders (Home Cell Leader / Unit Leader resolved against `members` + `unit_leader_assignments`); members of the configured Altar Ministry unit once `stage >= awaiting_altar_ministry`; admins.
  - UPDATE: stage1 fields → routed leader only; final + assignment fields → Altar Ministry unit leader/admin; completion → assigned owner or Altar Ministry leader/admin.
- Setting `pastoral.altar_ministry_unit` in `app_settings` (tenant-scoped, default `'Altar Ministry'`).

**Edge function**
- Extend existing `notify-pastoral-assignment` with new payload type `life_event_transition` that takes `{ request_id, transition, recipient_user_ids, pastor_names? }` and sends in-app + email. No new function file unless the existing one's surface area is too large to extend cleanly — in that case add `supabase/functions/notify-life-event/index.ts`.

**Frontend files touched**
- `src/pages/PastoralCare.jsx` — render life-event metadata, stage chips, action buttons; pass through to dialogs.
- `src/components/pastoralcare/PastoralCareRequestDialog.jsx` — add "Life Event" branch with the new fields and recipient checkboxes.
- New `src/components/pastoralcare/LifeEventApprovalDialog.jsx` — stage 1 approve/reject + stage 2 final-approve & assignment, conditionally rendered by role/stage.
- New `src/components/pastoralcare/LifeEventCard.jsx` (or inline section in `PastoralCareCard.jsx`).
- New hook `src/hooks/useAltarMinistry.js` — resolves the configured unit name and membership.
- `src/components/settings/...` — small "Altar Ministry unit" dropdown in the Pastoral Care settings panel.

**Permissions reuse**
- Home Cell Leader resolution: existing `wsf_centres` + member's `wsf_centre_id` → leader user ids.
- Unit Leader resolution: existing `unit_leader_assignments` matched on the member's `church_unit`.
- Altar Ministry membership/leader: same pattern as `useUnitMembership("Pastoral Care")`, but with the configured unit name.

**Notifications**
- Uses existing in-app `notifications` table insert + email template path already used by `notify-pastoral-assignment`.

**Audit**
- `logAudit` entries on each transition (`life_event.submit | approve_stage1 | reject | final_approve | reassign | complete`).
