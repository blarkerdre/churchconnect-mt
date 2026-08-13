# Sermon Notes: one personal library across churches

Sermon notes and folders become strictly personal to the user and follow them across every church they belong to, instead of being separated per church.

## What changes for the user

- Opening Sermon Notes in any church shows the same single library of notes and folders.
- Each note card shows a small badge with the church it was written in, so the origin is still visible.
- Notes are fully private: church admins can no longer read members' sermon notes.
- New notes are still stamped with the church the user is in when they write them (used only for the origin badge).

## Technical notes

Database (migration):
- Drop the admin read policy `Admins can view all tenant notes` on `sermon_notes`.
- Rewrite RLS on `sermon_notes` and `sermon_note_folders` to key only on ownership: `auth.uid() = user_id` for select/update/delete, and `auth.uid() = user_id` on insert (drop the `user_has_tenant_access(tenant_id)` requirement). Keep MFA gating consistent with the existing pattern if present on these tables.
- Keep the `tenant_id` column (nullable) purely as an origin label; no data migration or backfill needed.

Frontend:
- `src/pages/SermonNotes.jsx`: remove `.eq("tenant_id", tenantId)` from the notes and folders queries, from the move/bulk-move updates and bulk delete; drop `tenantId` from the query keys so switching church does not refetch a different set; remove the `!!tenantId` gate on the queries.
- `src/components/sermons/SermonFolderSidebar.jsx`: keep writing `tenant_id` on folder create, remove the tenant filter on folder update/delete.
- `src/components/sermons/SermonNoteFormDialog.jsx`: keep stamping `tenant_id` on insert, remove the tenant filter on update.
- Origin badge: load the user's tenant memberships (id + name) and render a badge with the note's originating church name on each card, next to the folder/category badges. Skip the badge when the note has no `tenant_id` or when the user belongs to only one church.
