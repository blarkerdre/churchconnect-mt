
## Goal

Make the Bible School (WOFBI) management area and all its dialogs/forms render cleanly from 320px phones up to desktop — no horizontal page scroll, no clipped controls, no cramped tables.

## Scope (frontend/presentation only)

Files to audit and tighten:

- `src/pages/ExamManagement.jsx` (main hub, ~1951 lines: tabs, filters, cards, tables, dialogs)
- `src/components/exams/*`:
  - `WoFBIApplicationsTab.jsx`, `WoFBIApplicationFormEditor.jsx`, `WoFBIDynamicForm.jsx`
  - `WoFBIAttendanceTab.jsx`, `WoFBIAttendanceQRDialog.jsx`, `WoFBIPersistentQRDialog.jsx`, `WoFBIRegistrationQRCode.jsx`
  - `SubjectManager.jsx`, `LecturerManager.jsx`, `LecturerFeedbackReport.jsx`
  - `CourseResultsView.jsx`, `StatementOfResult.jsx`, `SendResultsDialog.jsx`
  - `QcCheckDialog.jsx`, `QcReport.jsx`, `RateLecturerDialog.jsx`
  - `TakeExamDialog.jsx`, `DangerConfirmDialog.jsx`

## Fixes to apply

1. **Page container** — ensure `ExamManagement` root uses `min-w-0` and `px-3 sm:px-4 lg:px-6`; wrap any full-width row in `min-w-0` so flex children can shrink.
2. **Tab bars** — Applications / Registrations / Attendance / Subjects / Lecturers / Results / QC tab strips become horizontally scrollable on mobile (`flex overflow-x-auto no-scrollbar`, `whitespace-nowrap` triggers, `w-max` list).
3. **Filter rows** — status, search, cohort, date filters stack via `flex flex-col sm:flex-row flex-wrap gap-2`; inputs get `w-full sm:w-auto`, search grows with `flex-1 min-w-0`.
4. **Data tables** — every table wrapped in `<div className="overflow-x-auto -mx-3 sm:mx-0"><table className="min-w-[640px] w-full">…`; long text cells use `truncate` with a `title` for tooltip; action button clusters wrap.
5. **Card grids** — application/registration cards use `grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3`; internal two-column detail grids collapse to `grid-cols-1 sm:grid-cols-2`.
6. **Dialogs** — every `DialogContent` gets `w-[calc(100vw-1rem)] sm:w-auto max-w-[…] max-h-[90vh] overflow-y-auto p-4 sm:p-6`; footers become `flex flex-col-reverse sm:flex-row sm:justify-end gap-2` so buttons stack full-width on mobile.
7. **Form fields** — inside `WoFBIDynamicForm`, `WoFBIApplicationFormEditor`, `QcCheckDialog`, `RateLecturerDialog`, `SendResultsDialog`, `TakeExamDialog`: convert any hard `grid-cols-2/3` to responsive `grid-cols-1 sm:grid-cols-2`; long Selects get `w-full`; option chips wrap.
8. **QR dialogs** — QR canvas centered, capped at `w-[min(80vw,320px)]`; instructions stack; copy/download buttons full-width on mobile.
9. **Results / Statement of Result / QcReport** — printable views keep desktop layout but wrap runtime view in `overflow-x-auto`; headers/badges wrap with `flex-wrap gap-2`.
10. **Editor list rows** (`WoFBIApplicationFormEditor`) — the field row (label + up/down/edit/delete) becomes `flex flex-wrap` so controls don't push off-screen on 384px viewport.

## Verification

- Use Playwright at viewports 360, 414, 768, 1280 to load `/t/<slug>/exam-management`, open each tab, open one dialog per module (Application form editor, QC check, Rate lecturer, Send results, Take exam, QR), and screenshot. Confirm no horizontal scroll on `<html>`, all buttons visible, tables scroll only inside their wrapper.
- Spot-check the same on the running preview (currently 384×673).

## Out of scope

No changes to business logic, RLS, RPCs, edge functions, or data models. UI-only.
