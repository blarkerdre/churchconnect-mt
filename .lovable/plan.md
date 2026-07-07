## Goal

Give tenant admins/owners a simple **Hide / Unhide** toggle for each Church Unit in **Settings → Church Units**. Hidden units disappear from every member-facing surface (member forms, unit filters, audience filters, event/attendance pickers, sign-post dialog, unit tasks, communications, etc.) while admins keep full visibility and management in Settings.

## How it works

The `church_units` table already has an `is_active` boolean. Almost every consumer already uses the `useChurchUnits()` hook, which filters `is_active = true` by default. This change repurposes that flag as the **"Visible to members"** switch and closes the two remaining direct-query gaps.

## Changes

### 1. Settings → Church Units row (`src/pages/Settings.jsx`, `ChurchUnitsSection`)
- Add an inline **Eye / EyeOff** icon-button on each unit row that toggles `is_active` with one click (optimistic mutation, toast on success).
- Change the badge text from "Active / Inactive" to **"Visible / Hidden"**.
- In the edit dialog, rename the Active switch label to **"Visible to members"** with helper text: *"Hidden units are removed from member forms, filters and pickers. Existing member assignments are preserved."*
- No schema change.

### 2. Close direct-query gaps (member-facing paths)
- `src/pages/UnitTasks.jsx` line 49 — add `.eq("is_active", true)` to the `church_units` fetch used to populate the unit picker.
- `src/components/followups/SignPostDialog.jsx` line 71 — add `.eq("is_active", true)`.

### 3. Leave admin/settings paths unchanged
- The Settings section already queries **all** units (active + hidden) so admins can unhide them.
- `useChurchUnits(false)` remains available if any future admin-only screen needs the full list.

## Out of scope

- No changes to member records — hiding a unit does **not** clear existing `members.church_unit` assignments; those still display on member profiles/tables as text.
- No new permission model — the Settings page is already gated to admins/tenant owners.
- No schema migration.

## Verification

- As an admin, open Settings → Church Units, click the eye icon on a unit → badge flips to *Hidden*.
- As a non-admin member, open Members form / Events form / Communications audience filter / Attendance session dialog / Sign-post dialog / Unit Tasks → hidden unit no longer appears in dropdowns.
- Click the eye icon again → unit reappears everywhere.