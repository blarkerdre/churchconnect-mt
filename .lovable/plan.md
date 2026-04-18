
## Plan: Password-protected destructive deletes in Bible School Management

### Scope
Require password re-authentication AND show a strong warning before these destructive actions in `src/pages/ExamManagement.jsx` and `src/components/exams/SubjectManager.jsx`:

1. **Delete Course** (`exam_titles`) — cascades to subjects, questions, registrations, attempts
2. **Delete Course Registration** (`course_registrations`) — removes a member's enrolment
3. **Delete Subject** (`exam_subjects`) — cascades to questions
4. **Delete Question** (`exam_questions`)

### Approach

Build a reusable `<DangerConfirmDialog>` component (lightweight, local to the exams folder — `src/components/exams/DangerConfirmDialog.jsx`) that wraps `AlertDialog` and adds:

- **Red warning header** with `AlertTriangle` icon
- **Impact list** (props): bullet list of what will also be deleted (e.g. "All subjects, questions, attempts and registrations under this course")
- **Type-to-confirm** field — user must type the entity name (or `DELETE`) to enable the confirm button
- **Password input** — re-authenticates via `supabase.auth.signInWithPassword({ email: user.email, password })` before calling the delete mutation (same pattern used in `TenantAdmin.jsx` / `AppLayout.jsx` tenant switching)
- **Confirm button** disabled until both: type-to-confirm matches AND password is non-empty
- On submit: verify password → run the supplied `onConfirm()` callback → close

### Wiring (4 locations)

| File | Replace existing AlertDialog for… | Impact text |
|---|---|---|
| `ExamManagement.jsx` | `deleteTitleTarget` (course) | "All subjects, questions, registrations and attempts for this course will be permanently deleted." |
| `ExamManagement.jsx` | `deleteTarget` (question) | "This question and all member answers tied to it will be permanently deleted." |
| `ExamManagement.jsx` (`CourseRegistrationsView`) | `deleteTarget` (registration) | "The member's registration will be removed. Existing exam attempts are NOT deleted." |
| `SubjectManager.jsx` | `deleteTarget` (subject) | "All questions and member attempts under this subject will be permanently deleted." |

Each call site keeps its existing mutation; we simply gate it behind the new dialog.

### Security notes
- Password re-auth happens client-side via Supabase Auth — same proven pattern as tenant switching.
- All deletes already include `.eq("tenant_id", tenantId)` guards (verified). One small fix needed in `CourseRegistrationsView`: `tenantId` isn't currently destructured from `useTenantQuery()` in that sub-component — we'll add it.
- No DB migrations needed.

### Files
- **Create**: `src/components/exams/DangerConfirmDialog.jsx`
- **Edit**: `src/pages/ExamManagement.jsx` (3 dialog replacements + add `tenantId` in `CourseRegistrationsView`)
- **Edit**: `src/components/exams/SubjectManager.jsx` (1 dialog replacement)
