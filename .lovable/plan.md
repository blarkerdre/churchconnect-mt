# Performance ranking (1st, 2nd, 3rd...) in Bible School course results

Mirror the attendance punctuality ranking, but for exam performance: rank students by their overall course score.

## What you get

**Course results table**
- A new **Position** column showing 1st, 2nd, 3rd, 4th...ranked by overall percentage, highest first.
- Top three get the same medal-style highlight used in attendance (gold/silver/bronze); everyone else shows a plain ordinal.
- Students who have taken no exams yet (no score recorded) show a dash instead of a position.
- Equal percentages share the same position (a tie for 2nd is followed by 4th).
- Only students who completed all subjects are eligible for a position; partial students are shown unranked, so a partial roster can't out-rank a completed one.

**Per-subject results**
- Each subject's downloadable results also get a position column, ranked by that subject's percentage.

**Exports**
- Position added to the course results CSV, the printed course report, and the per-subject CSV.

Existing percentage, grade classification and pass/fail status stay exactly as they are — the position sits alongside them. Ranking respects the active edition filter, since it is computed from the results already on screen.

## Technical notes

- No database change. Ranking is derived in `src/components/exams/CourseResultsView.jsx` from the existing `members` array (`percentage`, `subjectsTaken`).
- Add a memo that sorts eligible members (`subjectsTaken === subjects.length`) by `percentage` descending and assigns a dense rank, ties sharing a position; store as `Map<memberId, position>`.
- Reuse the ordinal formatter and medal badge styling introduced for attendance in `WoFBIAttendanceTab.jsx` — extract them into a small shared helper (e.g. `src/lib/rank-utils.js`) so both views stay consistent.
- Wire the position into the results table header/rows, `buildPrintRows`, `handleDownloadCourseCSV`, and `handleDownloadSubjectCSV` (the latter ranked on its own `pct`).
