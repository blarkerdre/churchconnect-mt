## Goal

Add a **Course Report** feature in Bible School that generates an editable final report matching the uploaded Cardiff WOFBI BCC template, pre-filled from live data, saved per course/session, and exportable.

## Where it lives

New tab **"Course Report"** in Bible School (`src/pages/ExamManagement.jsx`), admin / reports-officer only, alongside the existing Application Form, Feedback Form, Lecturer Feedback and Quality Control tabs.

## Report structure (mirrors the template)

1. Cover — logo, centre name, course title + code, edition/session name, date range
2. Introduction (rich text, editable)
3. WOFBI Faculty — coordinating team + volunteers (editable lists)
4. Induction — date + student count
5. Class attendance figure
6. Statistics (5a) — water baptised, Holy Ghost baptised, new birth, testimonies recorded
7. Statistics (5b) — forms received, registered/confirmed, completed courses + test, at graduation, absentees
8. Nations representation — country + count list
9. Courses & lecturers table — S/N, course, code, lecturer (+centre)
10. General findings — attendance, registration, breaks, mobile phones, post-induction reminders, marking & grading, class coordinator, graduation, summary (each editable text)
11. Striking testimonies — heading + body + student name (repeatable)
12. Student feedback on lecturers — lecturer, course, QC person, QC rating + student average rating
13. Quality control observations — lecturer, course, QC personnel, general observations
14. Honorarium recommendation — course table with internal/external + remarks
15. Honorarium matrix — lecturer, no. of courses, recommended honorarium (£ per course, rate editable), signed COS/payroll
16. Next session note

## Auto-fill from existing data

Pre-filled on generate, every value still editable afterwards:
- Subjects/codes/lecturers from `exam_subjects` + `lecturers` (existing lecturer↔subject mapping)
- Registration counts and completion from `wofbi_applications` / `course_registrations` / `exam_attempts`
- Attendance figure from `wofbi_attendance_records` / sessions
- Nations from member `nationality` (recently added field)
- Testimonies from `testimonies` and from Feedback Form responses
- Student average ratings from `lecturer_ratings`; QC ratings and observations from `lecturer_qc_checks`
- Honorarium matrix computed from course counts per lecturer × editable rate

## Editing & saving

- Autosaved draft per (tenant, course, session) so it can be revisited and refined
- Section-by-section accordion editor with a "Refresh from data" button per section (never silently overwrites edits)
- Status: Draft / Final

## Export

- Print / PDF via a print-styled report view (same pattern as existing print reports)
- Word (.docx) download so the church can keep editing offline
- Fully responsive down to 384px (stacked tables on mobile)

## Technical notes

- New table `wofbi_course_reports` (tenant_id, course_id, session_id, status, `content` JSONB holding all sections, timestamps) with tenant-scoped RLS: admins/reports officers read+write, GRANTs for `authenticated` and `service_role`
- New components: `src/components/exams/CourseReportTab.jsx`, `CourseReportEditor.jsx`, `CourseReportPreview.jsx`, plus a `src/lib/wofbi-report-defaults.js` schema of the template sections
- Docx generation client-side; all dynamic text escaped in the print HTML (existing `escHtml` pattern)
