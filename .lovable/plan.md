## Goal
Let admins record a **subject code** for each Bible School subject, and mark each lecturer as **Internal** or **External**.

## 1. Database
One migration adding two columns:
- `exam_subjects.code` (text, nullable) — short subject code, e.g. "CH101".
- `lecturers.lecturer_type` (text, nullable, check constraint `internal | external`) — no default so existing rows stay blank until set.

No RLS/grant changes needed (both tables already exist with policies).

## 2. Subject code UI (`src/components/exams/SubjectManager.jsx`)
- Add a "Subject Code" input to the Add/Edit Subject dialog (optional, max ~20 chars, auto-uppercased, placed just under Subject Name).
- Include `code` in the create/update payload and in the edit form prefill.
- Show the code as a small mono badge next to the subject name in the subject list.

## 3. Lecturer type UI (`src/components/exams/LecturerManager.jsx`)
- Add a "Lecturer Type" dropdown (Internal / External) to the Add/Edit Lecturer dialog, next to Level.
- Save it on insert/update, prefill on edit.
- Add a "Type" column to the lecturers table showing an Internal/External badge (or "—" when unset).

## 4. Where it surfaces
- Lecturer selection dropdowns (subject form, rating and QC dialogs) show the lecturer name with an "(External)" suffix where applicable so the distinction is visible at point of use.
- Subject dropdowns show `CODE — Subject name` when a code exists.

## Notes
- Both fields are optional so nothing breaks for existing records.
- No changes to grading, exams, or reports logic; display only beyond the two new stored fields.
