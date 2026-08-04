# Make Bible School fit the screen properly

Checked every Bible School tab at a 384px phone width. Most tabs already stay inside the screen, but several things still don't fit comfortably. This plan fixes the layout across all Bible School features so nothing spills off-screen or gets clipped.

## What's wrong today

- **Lecturer Feedback tab overflows the page** — the page becomes 465px wide on a 384px screen, so the whole app shifts sideways and the "Rate a Lecturer" button gets cut off at the right edge.
- **Action buttons sit off the edge** — right-aligned toolbar buttons (Rate a Lecturer, Add Course, Add Subject, Export/Print) push past the card edge instead of wrapping.
- **Tab strips are scrollable but give no hint** — the top tab row and the inner tab rows (Subjects & Questions / Course Results / Registrations, and the report sub-tabs) cut off mid-word with no visual cue that they scroll.
- **Wide tables** — some report tables are not inside a horizontal scroll wrapper, so they stretch their container instead of scrolling within it.
- **Dialogs** — most are already fixed, but a few (Session manager, Rate Lecturer, QC Check, Send Results, Course Report editor) need consistent mobile width, safe-area bottom padding so Save isn't hidden behind the bottom nav, and stacked footers.

## What will change

1. **Stop the horizontal page overflow** on Lecturer Feedback: constrain the report container and its filter/summary/chart blocks with `min-w-0` / `w-full` and put the chart in a width-bounded responsive wrapper.
2. **Toolbars wrap on small screens** — headers across Management, Applications, Sessions, Attendance, Application Form, Feedback Form, Lecturer Feedback, Quality Control and Course Report become `flex-wrap` with full-width buttons on mobile.
3. **Tab strips get a scroll affordance** — keep horizontal scrolling, add edge fade/tighter mobile padding and smaller text so more tabs are visible at 384px.
4. **All report/roster tables** get a consistent `overflow-x-auto` wrapper with a sensible `min-w`, so the table scrolls inside its card rather than stretching the page.
5. **Filter rows** (course/subject/lecturer/level/date pickers, status filters) stack to one column on mobile and go side-by-side from `sm:` up; date inputs become full width instead of fixed pixel widths.
6. **Dialog consistency** — every Bible School dialog uses the same mobile pattern already used elsewhere in the app: `w-[calc(100vw-1rem)] sm:w-auto`, `max-h-[90vh] overflow-y-auto`, stacked full-width footer buttons on mobile, and bottom padding clear of the mobile nav bar.
7. **Verify** by re-measuring every tab at 384px to confirm page width equals the viewport with no clipped controls.

## Technical notes

Files touched (presentation only, no logic changes):
`src/pages/ExamManagement.jsx`, and in `src/components/exams/`: `LecturerFeedbackReport.jsx`, `QcReport.jsx`, `QcCheckDialog.jsx`, `RateLecturerDialog.jsx`, `WoFBIApplicationsTab.jsx`, `WoFBIAttendanceTab.jsx`, `CourseResultsView.jsx`, `CourseReportTab.jsx`, `SubjectManager.jsx`, `LecturerManager.jsx`, `SessionManager.jsx`, `SessionFilterBar.jsx`, `SendResultsDialog.jsx`, `WoFBIApplicationFormEditor.jsx`, `WoFBIFeedbackFormEditor.jsx`, `StatementOfResult.jsx`.

No data, query, or permission changes — Tailwind class and wrapper-markup adjustments only. Print/PDF/DOCX export layouts stay as they are.
