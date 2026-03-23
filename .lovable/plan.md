

## Plan: Rename "Exams" to "WoFBI"

Rename all user-facing references from "Exams" to "WoFBI" across the application. Internal code variables/table names stay unchanged.

### Changes

**`src/components/AppLayout.jsx`**
- Change nav item name from `"Exams"` to `"WoFBI"` (line 30)

**`src/pages/ExamManagement.jsx`**
- Page heading references to "Exams" → "WoFBI"
- Badge text `"Exams Open"` → `"WoFBI Open"`
- Label `"Exams Open"` in the course dialog → `"WoFBI Open"`
- Member view heading/text referencing "exams" → "WoFBI"

**`src/pages/MyProfile.jsx`**
- Card title `"Training Exams"` → `"WoFBI"`
- Any user-facing text mentioning "exams" → "WoFBI"

~4 files, text-only renames. No logic or schema changes.

