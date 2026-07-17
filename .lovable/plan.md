## Goal
Make the “parental consent required” state on the Teens Check-in page obvious and actionable, so cases like Ade test1 (`attendance_consent = false`) don't look like a mysterious failure.

## Changes (frontend-only, `src/pages/TeensCheckin.jsx`)

1. **Clearer inline error copy** (already mapped as `no_consent`). Reword to a two-line message with a next step:
   > *Parental consent required.*
   > A parent needs to open **My Family → Teenagers**, edit this teen, tick **“I give parental consent”**, and Save. Then try again.

2. **Signed-in guardian list — consent banner**
   When the guardian is signed in and one or more of their teens have `attendance_consent = false`, show a prominent amber banner above the teen list listing those names, with a **Manage consent** button that navigates to `/my-family`. The teen row keeps its “No consent” badge and stays disabled (existing behaviour).

3. **Self check-in picker — empty-state hint**
   When `publicTeens` is empty in `self-pick` / `parent-pin` modes, replace the generic “No teens available” text with:
   > *No teens are eligible to check in yet.* Teens only appear here after a parent gives attendance consent in **My Family → Teenagers**.

4. **Result screen dedicated consent block**
   When `error === "no_consent"`, render a dedicated card (amber shield icon + heading “Parental consent required”) with the copy from item 1 and two buttons: **Back** and (when signed in) **Open My Family** → `/my-family`.

No RPC, schema, or business-logic changes — the check-in gate itself is unchanged; only the messaging around it improves.

## Out of scope
- Adding an admin/worker consent override.
- Notifying the parent by email/push that consent is required.
- Changes to `MyFamily` / `TeensSection`.