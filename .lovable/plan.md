## No changes required

The auto-provisioned applicant already becomes a first-class member the moment they open the magic link. Nothing in the codebase branches on how the account was created, so every existing feature works for them with no additional work.

### What they get automatically after sign-in

- **Exam Management** — take exams, view student number, see attempt history
- **Rate Lecturer** — dialog appears in Exam Management once a course is attempted
- **Statement of Result** — generated per course from their `course_registrations` + `exam_attempts`
- **My Certificates** — appears on My Profile whenever an admin issues one via `IssueCertificateDialog`
- **My Profile** — full editing, avatar, sermon notes, etc.
- **Future sign-ins** — same email works for magic link, password reset, or setting a password later; no re-provisioning needed

### Why no code change is needed

- `ProtectedRoute` only checks for a valid Lovable Cloud session — which the magic link creates.
- RLS policies key off `auth.uid()` + `tenant_id`, both of which `provision-exam-account` sets up.
- `useAuth().myMember` resolves against the `members` row created during provisioning.
- Downstream features (`RateLecturerDialog`, `StatementOfResult`, `MyCertificates`) all read from `member_id` / `course_registrations`, which are already populated.

### Summary

Confirmed as-is. Plan closes with no file changes.