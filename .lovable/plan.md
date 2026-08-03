## Goal

Every delete that removes saved data anywhere in the app asks for your account password first. No delete should ever go through on a single tap or a plain browser "OK/Cancel" box.

## Current state (verified)

- A shared password prompt (`PasswordConfirmDialog`) and a stronger type-the-name variant (`DangerConfirmDialog`) already exist and are wired into roughly 24 screens (Members, Events, Followups, Settings, User Management, Transportation, Bible School courses/lecturers/subjects, WSF centres/zones, invoices, certificates).
- There is **no** global `useConfirmDelete()` hook — each screen wires the dialog by hand, which is why coverage is patchy.
- Around 40 files delete saved records **without** any password step, and 20+ places still use the browser's plain `confirm()` box, including:
  - Bible School: attendance sessions and records, application/registration deletes, QC entries, feedback responses, exam sessions/editions, result sends
  - Children's Church: Early Years, Preteens and Teens sections, attendance sessions and records, self-enrolments
  - Unit Tasks: task delete, assignee removal, service roster entries
  - Inventory items and categories
  - Training reports (session + attendee removal), Church attendance reports
  - Contacts, event registrations, report attachments, sermon notes and folders
  - Tenant Admin: platform users, tenant users, pricing plans, API keys
  - Unit-leader assignments, bulk pastoral re-assignment deletes

## What will be built

**1. One global confirmation service**

- New `DeleteConfirmProvider` mounted once in `App.jsx`, exposing a `useConfirmDelete()` hook.
- Call style: `await confirmDelete({ title, description, itemName, impacts, highImpact })` — it returns only after the password (and, when required, the typed name) is verified; otherwise it resolves as cancelled.
- The provider renders the existing `PasswordConfirmDialog` for standard deletes and `DangerConfirmDialog` (password + type the item's name + cascade impact list) when `highImpact` is set.

**2. High-impact deletes** (password **and** typing the item's name)

Anything that cascades into other records: Bible School sessions/editions and courses, attendance sessions of any kind (church, unit, Bible School, Early Years, Preteens, Teens), training sessions, user and tenant-user accounts, pricing plans, API keys, inventory categories, unit tasks, and any tenant-wide data purge.

**3. Standard deletes** (password only)

Single rows: individual attendance records, contacts, event registrations, attachments, sermon notes/folders, QC entries, feedback responses, assignees, family/child records, applications and registrations.

**4. Exclusions** (stay one-tap, as agreed)

Dismissing a notification, closing/cancelling a meeting or scheduled message, removing an unsaved field from a form builder, clearing device cache, and tour-state resets — none of these delete stored member data.

**5. Cleanup**

Every `confirm()` / `window.confirm()` used for a delete is replaced by the new hook, so the app has one consistent, branded prompt. Dialogs get mobile-safe spacing so the confirm button is never hidden behind the bottom navigation on a phone.

## Technical notes

- No database or Edge Function changes; verification reuses `supabase.auth.signInWithPassword` against the signed-in user's email, as the existing dialogs already do.
- Screens already using the dialogs directly will be migrated to the hook so there is a single implementation to maintain.
- The rule ("all deletes go through `useConfirmDelete()`, never `window.confirm`") will be recorded in project memory so future features inherit it automatically.
