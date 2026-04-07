

## Send Course Registration Email + Result/Certificate Email on Exam Completion

### What This Does
1. When a logged-in member registers for a course (in-app), they receive a confirmation email
2. When an exam is completed and graded, the member receives an email with their result statement (scores, grade)
3. Certificate emails are already sent — no change needed there

### Current State
- **Public registration** (`public-wofbi-register` edge function) already triggers `send-course-registration-email` — working
- **In-app registration** (`ExamManagement.jsx` and `MemberFeed.jsx`) does NOT send any email — just inserts into `course_registrations`
- **Exam grading** (`grade-exam` edge function) issues certificates on completion but does NOT email the result statement
- **Certificate email** is already sent by `issue-certificate` edge function — no change needed

### Changes

#### 1. In-app course registration email — `src/pages/ExamManagement.jsx`
After successful registration in `registerMutation.onSuccess`, call the existing `send-course-registration-email` edge function with the member's email, name, course name, and tenant_id. Need to look up member email and the course name from available data.

#### 2. In-app course registration email — `src/components/profile/MemberFeed.jsx`
Same pattern — after successful registration, trigger the course registration email.

#### 3. Exam result email — `supabase/functions/grade-exam/index.ts`
After grading is complete (attempt inserted), send an email with the result statement:
- Member name, subject/course name, score, total, percentage, pass/fail, grade
- Use the existing `enqueue_email` RPC pattern (same as `issue-certificate`)
- Build an HTML email showing a results table
- Only send if the member has an email address

#### 4. New email template — Result Statement
Create an inline HTML email in `grade-exam/index.ts` (matching the style of the certificate email) showing:
- Subject/course name
- Score breakdown (score / total points, percentage)
- Pass/Fail status with grade classification
- Link to dashboard to view full details

### Technical Details
- The `send-course-registration-email` edge function already exists and accepts `{ email, first_name, course_name, tenant_id }` with service role auth
- For the result email, we use `enqueue_email` RPC (same pattern as certificate email in `issue-certificate`)
- The grade-exam function already has access to member info, scores, and tenant context
- No new database tables or migrations needed

### Files Changed
- `src/pages/ExamManagement.jsx` — trigger registration email on in-app registration
- `src/components/profile/MemberFeed.jsx` — trigger registration email on in-app registration
- `supabase/functions/grade-exam/index.ts` — send result statement email after grading

