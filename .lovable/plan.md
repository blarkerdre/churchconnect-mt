

## Add Sermon Notes Feature

### What This Does
Members can write, save, and review personal sermon notes directly within the app. Each note is tied to a date and optionally a sermon title/speaker. Notes are private to each member.

### Database

#### New table: `sermon_notes`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | default gen_random_uuid() |
| user_id | uuid NOT NULL | references auth.users(id) |
| tenant_id | uuid | tenant scoping |
| title | text | sermon title (optional) |
| speaker | text | preacher name (optional) |
| service_date | date | defaults to today |
| content | text NOT NULL | the actual notes |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |

**RLS policies:**
- Members can CRUD their own notes (`auth.uid() = user_id AND user_has_tenant_access(tenant_id)`)
- Admins can view all notes in their tenant (read-only)

### New Page: `src/pages/SermonNotes.jsx`
- List view showing saved notes sorted by date (newest first)
- Search/filter by title or date
- "New Note" button opens a form dialog
- Click a note to view/edit it
- Delete option on each note

### New Component: `src/components/sermons/SermonNoteFormDialog.jsx`
- Dialog with fields: Title (optional), Speaker (optional), Date, Content (textarea, large)
- Save creates/updates the note via Supabase

### Navigation
- Add "Sermon Notes" to `allNavItems` in `AppLayout.jsx` with `access: null` (all authenticated users)
- Use the `BookOpen` or `FileText` icon (will use `FileText` since `BookOpen` is taken by Bible School)

### Route
- Add `/sermon-notes` route in `App.jsx` pointing to the new page

### Files changed
- **Database migration** — create `sermon_notes` table with RLS
- **New**: `src/pages/SermonNotes.jsx` — list + view notes
- **New**: `src/components/sermons/SermonNoteFormDialog.jsx` — create/edit dialog
- `src/App.jsx` — add route
- `src/components/AppLayout.jsx` — add nav item

