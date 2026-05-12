## Goal
Make the admin → registration → exam flow strict, predictable, and correct so every state shows the right control and the wrong ones can't reach the exam.

## What's wrong today
- **OpenSessionsPanel hides itself** when `auto_open_exams=true` and the member has no row for *this* session — even if the member has a stale row tied to a *closed* prior session. Members lose the visible "Register" affordance and assume nothing is happening.
- **DynamicExamButtons silently auto-registers** on first subject click (under `auto_open_exams`), so registration becomes invisible/implicit. Combined with the panel hiding, members report "no exam button" when in fact the button is one screen away or behind a confusing state.
- **Course-level `exams_open` flag** is mixed into the gate (`registeredCourseIds.has(c.id) && (c.exams_open || registeredViaOpenSession.has(c.id))`). It's redundant with session status and creates "registered but locked" states.
- **No server-side guard**: a `course_registrations` row can be inserted referencing a closed/draft session, or a member with no registration can have `exam_attempts` inserted for a session-gated course.
- **Stale rows from past sessions** (e.g. Adeniyi → BCC → closed "Test Session") confuse the UI: panel says "Registered" but the badge refers to an inactive session.

## What "open" should mean (single source of truth)
A subject's exam is **takeable** when **all** are true:
1. Subject's course is included in an `exam_session` with `status='active'`.
2. Either (a) member has a `course_registrations` row with `session_id` = that active session, **or** (b) the active session has `auto_open_exams=true` (open enrolment).
3. The member has no prior passing attempt for the subject, **unless** `retake_allowed=true` on the latest attempt.

`exam_titles.exams_open` is dropped from the gate — sessions own openness.

## Plan

### 1. UI — `OpenSessionsPanel.jsx`
- Always render every active session the member is eligible for. Replace the auto-hide block.
- Per session, show one of three states:
  - **Registered for this session** → green badge + "Take exams below" hint.
  - **Open enrolment (auto_open)** → blue chip "Open to all members — register to track your progress" + a `Register` button (still useful so the member's row reflects this session, not a closed one).
  - **Manual** → `Register` button (or "Re-registration disabled" notice when applicable).
- Drop the silent path: don't depend on `DynamicExamButtons` for first-time enrolment.

### 2. UI — `DynamicExamButtons` in `MyProfile.jsx`
- Replace the mixed gate with the rule above: a course renders if and only if it's in an active session AND (member registered for that session OR `auto_open_exams=true`).
- Remove auto-insert in `handleSubjectClick`. If the member somehow lands here without a registration row for the active session, redirect them to register via the panel (toast: "Please register for this session first").
- Keep best-attempt + retake disable logic untouched.

### 3. Admin — `ExamSessionManager.jsx`
- Tighten the help text on the two switches so the difference is obvious:
  - **Auto-open exams while active** → "Anyone can take these exams without admin enrolment."
  - **Allow re-registration** → "Members who took a course in a previous session can register again here."
- Block starting a session that has zero courses (currently silently allowed at edit time).
- When stopping a session, warn that in-progress attempts will not be auto-submitted (informational only).

### 4. Server-side guards (migration)
- `BEFORE INSERT` trigger on `course_registrations`: if `session_id IS NOT NULL`, the referenced session must be `status IN ('draft','active')` and belong to the same tenant. Reject otherwise.
- `BEFORE INSERT` trigger on `exam_attempts`: if the subject's course is included in any session for the tenant, require an active session covering that course AND either a matching registration for the member or `auto_open_exams=true` on that session. Free-standing courses (not in any session) remain allowed (back-compat).
- Both triggers raise clear `RAISE EXCEPTION` messages so the UI can surface them.

### 5. Cleanup utility (one-off, optional)
- Add an admin button on each closed session in `ExamSessionManager`: "Migrate stragglers to current session" — re-points orphan registrations whose course is part of the currently active session. Out of scope for the trigger work; surface but don't auto-run.

### 6. Memory
- Append to `mem://features/exams/security`: openness rule (session-owned), the two triggers, and that `exam_titles.exams_open` is no longer part of the gate.

## Out of scope
- Time-window enforcement based on `starts_on`/`ends_on` (still informational).
- Bulk migration of historical orphan registrations.
- Changes to grading (`grade-exam` edge function) or certificate issuance.

## Files touched
- `src/components/exams/OpenSessionsPanel.jsx`
- `src/pages/MyProfile.jsx` (`DynamicExamButtons` only)
- `src/components/exams/ExamSessionManager.jsx`
- New migration: `enforce_course_registration_session` + `enforce_exam_attempt_eligibility` triggers
- `mem://features/exams/security`
