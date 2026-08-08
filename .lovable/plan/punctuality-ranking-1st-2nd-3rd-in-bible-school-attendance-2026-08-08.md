# Punctuality ranking (1st, 2nd, 3rd...) in Bible School attendance

Rank students by how early they arrived, using the check-in time already recorded on each attendance record — whether the student scanned the QR code or a worker marked them in manually.

## What you get

**Per session**
- Each session's roster shows an arrival position: 1st, 2nd, 3rd, 4th... ordered by earliest check-in time.
- Top three get a subtle medal-style highlight (gold/silver/bronze); everyone else shows a plain ordinal.
- Students with no check-in time (absent, or marked present without a time) show a dash instead of a position.
- Ties on identical timestamps share the same position.

**Cumulative (per edition/course)**
- The per-student summary table gains two columns: **Avg. position** (average arrival place across the sessions they attended) and **Punctuality rank** (1st, 2nd, 3rd... across the whole edition, best average first).
- Students who never checked in are listed unranked at the bottom.
- Ranking respects the active edition filter, so switching editions recalculates it.

**Exports**
- Arrival position added to the per-session roster download (CSV and PDF).
- Avg. position and punctuality rank added to the course attendance CSV and the cumulative roster PDF.

The existing star rating, punctuality % and grade stay as they are — the arrival ranking sits alongside them.

## Technical notes

- No database change. Positions are derived in `src/components/exams/WoFBIAttendanceTab.jsx` from `attendance_records.checked_in_at`, which is already selected in the roster query.
- Add a memo that, for each session, sorts its records by `checked_in_at` ascending (nulls excluded) and produces a `Map<record_id, position>`; ties on equal timestamps get the same position.
- Extend the existing `perStudent` memo with `avgPosition` (mean of that student's positions) and `punctualityRank` (dense rank over `avgPosition`, ascending).
- Wire the new values into the session roster table, the summary table, `exportCsv`, `buildSessionRoster`, and `buildCourseRoster`.
