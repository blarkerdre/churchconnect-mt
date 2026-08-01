## What I found

The "Remarks" column **does exist** in the report — it's the last column of section **12. Honorarium Recommendation** (`src/lib/wofbi-report-export.js` renders `S/N | COURSE | CODE | LECTURERS | TYPE | REMARKS`), and it is editable in the Honorarium accordion of the report editor.

It looks empty because the autofill in `CourseReportTab.jsx` explicitly seeds every honorarium row with `code: ""`, `type: ""`, `remarks: ""`. There are currently no saved reports in the database, so what you see is the freshly autofilled version — three blank columns, which makes the column look missing in the preview/print output.

## Fix

1. **Autofill Code** — use the new `exam_subjects.code` for each subject row instead of an empty string.
2. **Autofill Type** — use the new `lecturers.lecturer_type` (Internal / External), capitalised, instead of an empty string.
3. **Autofill Remarks** — generate a sensible default per lecturer/subject, based on the data already gathered during autofill:
   - "Recommended for honorarium" when the lecturer has QC and/or student ratings recorded at or above the pass threshold,
   - "Pending quality control review" when no QC entry exists for that subject.
   Still fully editable — typing over it always wins.
4. **Blank cells render as "—"** in the exported/printed tables so an empty Remarks (or Code/Type) cell is visibly present rather than looking like a missing column.

## Technical notes
- Changes are confined to the autofill block in `src/components/exams/CourseReportTab.jsx` (subject/lecturer queries need `code` and `lecturer_type` added to their `select`) and the table cell helper in `src/lib/wofbi-report-export.js`.
- No schema changes; no change to saved reports — existing edited values are preserved because autofill only runs on seeding/explicit "Autofill".
