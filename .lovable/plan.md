## Goal

Let members organise their personal sermon notes into **folders** (e.g. "Sunday Service", "Bible Study", "Conferences"), in addition to the existing free-text Category field.

## UX

On the **Sermon Notes** page (`/sermon-notes`):

- A new **left-hand folder rail** (collapsible drawer on mobile, sidebar on desktop) lists the user's folders with note counts:
  - "All Notes" (default)
  - "Uncategorised" (notes without a folder)
  - User's custom folders, each with rename / delete actions
  - "+ New Folder" button at the bottom
- Selecting a folder filters the grid to notes in that folder. Existing search / sort / category filter still apply on top.
- In the note card grid, each card shows a small folder badge so users see where it lives.
- In the **note form dialog**, add a **Folder** dropdown (with "None" + the user's folders + an inline "Create new folder…" option) — so a note can be filed when created or edited.
- Users can **move notes between folders** by:
  - changing the dropdown in the edit dialog, or
  - a "Move to folder" item in a small ⋯ menu on each card (quick reassign without opening the editor).
- Deleting a folder asks: "Move its notes to Uncategorised, or delete folder only?" — notes themselves are never deleted by folder removal.

Folders are **per-user, per-tenant** (private organisation, same as the notes themselves).

## Technical Plan

### 1. Database (new migration)

```sql
create table public.sermon_note_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, tenant_id, name)
);

alter table public.sermon_note_folders enable row level security;

-- Owner-only CRUD, tenant-scoped
create policy "Users manage own folders"
  on public.sermon_note_folders for all
  using (auth.uid() = user_id and user_has_tenant_access(tenant_id))
  with check (auth.uid() = user_id and user_has_tenant_access(tenant_id));

create index idx_sermon_note_folders_user_tenant
  on public.sermon_note_folders (user_id, tenant_id);

create trigger update_sermon_note_folders_updated_at
  before update on public.sermon_note_folders
  for each row execute function public.update_updated_at_column();

-- Add nullable folder reference to sermon_notes
alter table public.sermon_notes
  add column folder_id uuid references public.sermon_note_folders(id) on delete set null;

create index idx_sermon_notes_folder on public.sermon_notes (folder_id);
```

`on delete set null` means deleting a folder leaves the notes intact in "Uncategorised". The "move to uncategorised vs delete" UX is handled client-side before issuing the delete.

### 2. Frontend changes

**`src/pages/SermonNotes.jsx`**
- Add `useQuery` for `sermon_note_folders` (per user + tenant).
- Add `selectedFolder` state (`"all" | "uncategorised" | <folderId>`).
- Render folder rail (`<SermonFolderSidebar>`) on the left; main content on the right.
- Filter `notes` by `folder_id` when a specific folder is selected.
- Show folder badge on each card.

**New `src/components/sermons/SermonFolderSidebar.jsx`**
- Lists folders with counts, handles select/rename/delete.
- "+ New Folder" inline input.
- Confirm dialog on delete (notes auto-fall back to Uncategorised via `set null`).

**`src/components/sermons/SermonNoteFormDialog.jsx`**
- Add a `folder_id` Select populated from the folders query.
- Include "None" and "Create new folder…" options. New-folder inline input creates the folder, then assigns its id to the note before save.
- Save `folder_id` in insert/update payloads.

**Optional small `MoveToFolderMenu` on the card**
- Dropdown menu (`@/components/ui/dropdown-menu`) triggered from a ⋯ button next to Edit/Delete, listing folders for quick reassign. Updates `folder_id` directly via Supabase and invalidates the query.

### 3. Multi-tenancy guards

All folder reads/writes include `.eq("tenant_id", tenantId)` and `.eq("user_id", user.id)` per the project's mandatory tenant-scoping rule. The same applies when updating `folder_id` on `sermon_notes`.

### 4. Types

`src/integrations/supabase/types.ts` regenerates automatically after the migration — no manual edit.

## Files Touched

- New migration: `supabase/migrations/<timestamp>_sermon_note_folders.sql`
- New: `src/components/sermons/SermonFolderSidebar.jsx`
- Edited: `src/pages/SermonNotes.jsx`
- Edited: `src/components/sermons/SermonNoteFormDialog.jsx`
- Memory update: append a folder note to `mem://features/sermon-notes`

## Out of Scope

- Nested / sub-folders (single-level only for now).
- Drag-and-drop reordering of notes between folders (use the dropdown / form for now).
- Sharing folders between users.