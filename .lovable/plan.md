
## Fixes to apply to `/mnt/documents/followups-process-map.png`

Current issues in the existing PNG:
1. Vertical swimlane titles ("Signposting Flow", "Lifecycle", "Roles & Permissions", "Notifications & Escalations") are clipped/overlap adjacent boxes.
2. In the Signposting lane, the "Referral timeline updated · notifications fired · closure on completion" caption sits behind the swimlane title.
3. The "Reports Officer" caption in the Roles lane is cut on the right edge.
4. Dashed feedback arrow from Decline → back is not clearly labelled.
5. Lifecycle lane omits the actual triggers ("First-Timer / New Convert / Visitor registered" auto-inserts via DB trigger, not "New convert trigger" only).
6. Scheduled-message engine (48h, day-3, day-7 template drips) is missing from the Notifications lane.

## Regenerated map — `/mnt/documents/followups-process-map-v2.png`

Rebuild via `matplotlib` with:
- Wider left gutter (240 px) so each swimlane title renders horizontally on two lines instead of vertically clipped.
- Titles: "Signposting Flow", "Follow-up Lifecycle", "Roles & Permissions", "Notifications & Escalations" — full-width chip, no rotation.
- Move the Signposting caption out from under the title.
- Widen canvas to 2600×1700 so Reports Officer node fits.
- Label the dashed arrow "creates follow-up on Accept".
- Lifecycle triggers replaced with the real four entry points: **First Timer registered**, **New Convert registered**, **Visitor registered**, **Manual create / From signpost / Absence alert**.
- Add a Notifications sub-track for **scheduled template messages** (day 1 / 3 / 7 SMS + Email + WhatsApp) fed by `followup_message_templates`.
- Keep navy `#1e3a5f` + gold `#c9a961` palette, Playfair-style title, Source-Sans body.

## Thorough narrative — First-Timer-triggered follow-up

Written as a section under the diagram (rendered into the PNG footer as small caption text, plus delivered inline in chat):

```text
1. TRIGGER
   Member is inserted into `members` with membership_status = 'First Timer'
   via PublicRegistration form, admin MemberFormDialog, or bulk import.

2. DB TRIGGER: auto_create_followup (SECURITY DEFINER)
   Fires AFTER INSERT (or on status change to First Timer / New Convert /
   Visitor). Steps executed atomically inside the same transaction:

   a. Compose description
      "New first timer registered: <First> <Last>. Welcome and connect
       them to the church."

   b. Pick least-busy assignee from the Follow-up team pool:
      - unit_leader_assignments where unit_name ILIKE 'follow-up'
      - members where church_unit ILIKE '%follow-up%'
      Ordered by count of Pending/In-Progress follow-ups already held,
      ties broken by random(). LIMIT 1.

   c. INSERT into followups
      { member_id, followup_type = 'First Timer', status = 'Pending',
        priority = 'High', assigned_to = <chosen leader>,
        tenant_id = NEW.tenant_id }

   d. Fan-out scheduled messages
      For every active row in followup_message_templates matching
      followup_type = 'First Timer' and tenant_id, INSERT a row into
      followup_scheduled_messages with scheduled_at = now() + delay_days.
      Channels: sms | email | whatsapp | in_app.

   e. Notify the follow-up team
      Insert notifications for every Follow-up leader/member; the
      Edge Function pipeline sends the in-app bell + optional email /
      SMS / WhatsApp using tenant provider config.

3. INBOX SURFACING
   - Assignee sees the item on Dashboard "Signposted to me" widget
     and in /followups filtered by assigned_to = auth.uid().
   - Admins, Reports Officer, and the Follow-up unit see it via RLS.

4. WORK LOOP (FollowupDetailPanel)
   Assignee logs each contact attempt (Call · SMS · WhatsApp · Email
   · Visit), records notes/outcome, and moves status through:
   Pending → In Progress → Awaiting Response → Completed.
   Alternate terminal states: Reassigned, Unreachable.

5. AUTOMATED DRIP
   The followup-scheduled-messages Edge Function polls due rows and
   dispatches them; failures mark status = 'failed' with error text
   surfaced in the panel.

6. ESCALATION
   - 48h with no contact → reminder to assignee (in-app + email).
   - due_date passed → "Overdue" badge + OverdueReminder banner.
   - SLA breach → admin escalation notification.
   - Weekly digest to Admin / Tenant Owner summarises open First-Timer
     follow-ups.

7. CLOSURE
   Assignee marks Completed; if First Timer is ready, one-click
   "Convert to Member" sets members.membership_status = 'Active',
   auto-completes the follow-up, stamps completed_date, and appends
   a closure note. member_status_history captures the transition.
```

## Deliverables

- New file: `/mnt/documents/followups-process-map-v2.png` (2600×1700, 180 DPI).
- Presentation-artifact tag pointing to v2.
- Inline chat: the 7-step First-Timer narrative above (condensed).
- No source-code, DB, or RLS changes.
