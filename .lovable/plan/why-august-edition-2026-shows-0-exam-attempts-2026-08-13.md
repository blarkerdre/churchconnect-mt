# Why "August Edition 2026" shows 0 exam attempts

## What the data shows

All 491 exam attempts in the database have an empty edition (`session_id` is blank), so filtering by an edition matches none of them. That is why the Sessions list reports 0 attempts for August Edition 2026 even though results exist.

The link is recoverable: every attempt points at a subject, and those subjects do carry an edition. Mapping attempts through their subject gives:

- 486 attempts → August Edition 2026
- 5 attempts → Test Session

New attempts created from now on are already stamped correctly by the grading function; only the historical rows (created 18 Jul – 8 Aug 2026, i.e. before editions were introduced) are blank.

## Fix

1. Backfill `exam_attempts.session_id` from each attempt's subject edition. This changes no scores or results — only the edition label.
2. Add a database trigger on `exam_attempts` that fills the edition from the subject on insert, so any path that creates an attempt (not just the grading function) is stamped, and the gap cannot reappear.
3. Same one-off backfill for the small number of other Bible School records still missing an edition, using their course/date match: 2 course registrations, 4 applications, 1 attendance session, 1 lecturer rating. Anything that genuinely cannot be matched stays under "Unassigned edition".

After this, selecting "August Edition 2026" shows its 486 attempts, and the Sessions tab counts, results, rankings and reports line up per edition.

## Technical notes

- Migration: `UPDATE public.exam_attempts a SET session_id = s.session_id FROM public.exam_subjects s WHERE s.id = a.subject_id AND a.session_id IS NULL AND s.session_id IS NOT NULL;`
- New `BEFORE INSERT OR UPDATE OF subject_id` trigger function `stamp_exam_attempt_session()` (SECURITY DEFINER, `search_path = public`) setting `NEW.session_id` from `exam_subjects` when null.
- Secondary backfills join on `exam_session_courses` (course + date within the session range), leaving non-matches null.
- No RLS, grant, or UI changes needed — the existing edition filter already reads `session_id`.
