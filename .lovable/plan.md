## Goal

Every delete action in the app asks the signed-in user to re-enter their password before anything is removed — no exceptions, and no "remember for X minutes" window.

## Approach

Rather than hand-wiring the existing `PasswordConfirmDialog` into ~50 files, add a single app-wide confirmation service so each delete site becomes a one-line change.

### 1. Global delete-confirmation provider
- New `DeleteConfirmProvider` mounted once in `App.jsx`, rendering one shared password dialog.
- Exposes `useConfirmDelete()` returning `confirmDelete({ title, description, confirmLabel, onConfirm })`.
- The dialog verifies the password against the signed-in account before running `onConfirm`; a wrong password blocks the delete and shows an error. Cancel does nothing.
- Prompts every time — no caching of a verified state.

### 2. Convert all delete call sites
Replace existing one-click deletes and plain `AlertDialog` "Are you sure?" confirmations with `confirmDelete(...)`, keeping each item's current wording as the dialog description. Covers, across the app:
- Members, Early Years / Preteens / Teens and My Family records, users, roles and unit/home-cell assignments, tenants and platform users
- Attendance sessions and records (church, unit, home cell, teens, preteens, Bible School), check-ins
- Bible School: courses, sessions, subjects, lecturers, QC checks, feedback forms, results, reports
- Events and registrations, follow-ups, pastoral care, unit tasks and comments, inventory, transportation, training reports
- Communications: contacts, announcements, templates, API keys, external links, invoices, certificate templates, banners
- Personal items: sermon notes and folders, notifications, report attachments, documents

### 3. Sign-out safety
Password verification re-authenticates the current account. Keep the existing session intact so a failed or successful check never signs the user out or drops them from the page.

## Technical notes

- New files: `src/components/shared/DeleteConfirmProvider.jsx` (provider + context + hook). `PasswordConfirmDialog.jsx` is reused as the dialog body.
- `src/App.jsx` wraps the routed tree in the provider, inside the auth and tenant providers.
- Roughly 50 files are edited to swap their delete triggers to `confirmDelete(...)`; existing `AlertDialog` confirm wrappers are removed where they become redundant.
- No database, RLS, or edge-function changes — this is a client-side confirmation gate; server-side permissions already govern who may delete what.
- Trade-off to note: this adds a password prompt to lightweight actions such as dismissing a notification or deleting one's own sermon note, as requested.
