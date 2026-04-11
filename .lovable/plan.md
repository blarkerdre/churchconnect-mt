

## Add Email Notification Toggles for Exam Results & Certificates

### Overview
Add two per-course toggles that control whether participants receive (1) a Statement of Result email and (2) a Certificate email upon exam completion. Both default to enabled for backward compatibility.

### Database Migration
Add two boolean columns to `exam_titles`:

```sql
ALTER TABLE public.exam_titles
  ADD COLUMN send_result_email boolean NOT NULL DEFAULT true,
  ADD COLUMN send_certificate_email boolean NOT NULL DEFAULT true;
```

### Implementation

#### 1. Course Form — `src/pages/ExamManagement.jsx`
- Add `send_result_email` and `send_certificate_email` to `titleForm` state (default `true`)
- Add two Switch toggles in the course dialog (after "Exams Open"):
  - "Email Result Statement on Completion"
  - "Email Certificate on Completion"
- Include both fields in the save mutation payload
- Populate them when editing an existing course

#### 2. Edge Function — `supabase/functions/grade-exam/index.ts`
- After grading, fetch the course's `send_result_email` and `send_certificate_email` flags from `exam_titles`
- Conditionally skip `sendResultEmail()` if `send_result_email` is false
- Pass `send_certificate_email` flag to `checkCourseCompletion()` and `issueCertificate()`, and conditionally skip email sending in the certificate flow (the certificate record is still created, only the email notification is controlled)

#### 3. Fix runtime error
- The `useEffect` null error appears to be a transient Vite HMR issue, not a code bug. Will monitor.

### Files changed
- **Migration**: Add two columns to `exam_titles`
- **Edit**: `src/pages/ExamManagement.jsx` — add toggles to course form
- **Edit**: `supabase/functions/grade-exam/index.ts` — conditionally send emails
- **Edit**: `supabase/functions/issue-certificate/index.ts` — respect `send_certificate_email` flag

