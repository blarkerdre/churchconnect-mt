

## Add Sermon Notes Organization (Categories, Sort, Filter)

### Overview
Add the ability to organize sermon notes by categories/tags, sort by different fields, and filter by category. This gives users a way to group and find notes more easily.

### Database Migration
Add a `category` column to the `sermon_notes` table:

```sql
ALTER TABLE public.sermon_notes ADD COLUMN category text DEFAULT null;
```

No new RLS policies needed — existing policies cover the column automatically.

### Implementation

#### 1. Update `SermonNoteFormDialog.jsx`
- Add a "Category" input field (with autocomplete from existing categories) between Speaker and Date fields
- Save category value with the note payload

#### 2. Update `SermonNotes.jsx`
- Add sort controls: sort by Date (default), Title, Speaker, or Category
- Add ascending/descending toggle
- Add category filter dropdown populated from unique categories in the user's notes
- Show category badge on each note card
- Filter notes by selected category before applying search

#### 3. UI Layout (mobile-friendly at 384px)
- Toolbar row with: Search input | Sort dropdown | Category filter dropdown
- Category badge shown on each card below the date
- Sort options: Date (newest), Date (oldest), Title A-Z, Speaker A-Z

### Files changed
- **Migration**: Add `category` column to `sermon_notes`
- **Edit**: `src/components/sermons/SermonNoteFormDialog.jsx` — add category field
- **Edit**: `src/pages/SermonNotes.jsx` — add sort, category filter, and category badges

