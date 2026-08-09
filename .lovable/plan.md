# Issue certificates without sending them

Today, generating a Bible School certificate immediately emails it to the student and it appears in their profile. This adds a two-step flow: **Issue** (generate and store, staff-only) and **Send** (release to the student).

## How it will work

1. Staff issue a certificate as usual. It is generated, numbered and stored, but the student receives no email and does not see it in My Certificates.
2. The certificate appears in the staff list with a "Not sent" badge and a **Send to student** button.
3. Clicking Send (single or bulk) emails the certificate, posts an in-app notification, marks it "Sent" with a timestamp, and makes it visible to the student.
4. Already-sent certificates show "Sent on <date>" with a **Resend** option.
5. Existing certificates already issued before this change are treated as sent, so nothing disappears from students' profiles.

Staff can still preview, download, re-issue and bulk-download certificates at any stage, sent or not.

## Where it appears

- Member profile → Issue Certificate dialog (issue, then send)
- Bible School → Course Results (bulk issue, bulk send, status column)
- Certificates Report / Certificate Approvals (status column and send action)
- Student's My Certificates (only sent certificates listed)

## Technical notes

- Migration on `training_completions`: add `sent_to_student_at timestamptz`, `sent_by uuid`; backfill existing rows to `created_at` so they stay visible. Keep grants unchanged; update the member-facing SELECT policy so members only see rows where `sent_to_student_at is not null` (admin/leader policies unchanged).
- `issue-certificate` edge function: default to no email; only email when the request explicitly sets a send flag. On send, set `sent_to_student_at`/`sent_by`, enqueue the email, insert a notification, and write an audit log entry. Course-level `send_certificate_email` toggle continues to suppress emails, but the release still makes the certificate visible in-app.
- Add a `send_certificate` action path (reuse the same function with `mode: "send"` on an existing `completion_id`) so sending never regenerates the file.
- Update `IssueCertificateDialog.jsx`, `CourseResultsView.jsx`, `SendResultsDialog.jsx`, `CertificatesReport.jsx`, `CertificateApprovals.jsx` for the new status/actions, and `MyCertificates.jsx` to rely on the released flag.
