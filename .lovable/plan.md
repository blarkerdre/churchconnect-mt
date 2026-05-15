## Finding

`exam_titles` has a broad `Authenticated can view exam titles` SELECT policy. The scanner flags it because fields like `grade_classifications`, `pass_mark_percentage`, `send_certificate_email`, `send_result_email` could be considered internal config.

## Reality check

These fields are actually used by member-facing client code:

- `TakeExamDialog.jsx` reads `pass_mark_percentage` to show pass requirements
- `MyProfile.jsx` reads `name, send_certificate_email` to render certificate UI
- `ExamSessionManager`, `OpenSessionsPanel`, `SessionEnrolDialog`, `IssueCertificateDialog`, `CertificateTemplateSettings` all read `exam_titles` directly
- The public `get_public_courses_for_tenant` RPC is only used by the unauthenticated WoFBI registration page, not by signed-in members

So members legitimately need read access. The fields the scanner highlights are not secrets — they're operational settings members see anyway when taking exams or viewing certificates.

## Recommended path

**Dismiss as accepted risk** and update the security memory. Rationale:

- All listed fields are non-sensitive operational config
- Tenant scoping is already enforced by RLS (`tenant_id = current tenant`)
- No PII or credentials exposed
- Routing every read through an RPC adds maintenance cost with zero security gain

I'll mark the finding as ignored and update `@security-memory` to record that authenticated tenant-scoped SELECT on `exam_titles` is intentional, with the RPC reserved for unauthenticated public registration.

## Alternative (if you'd rather harden)

If you'd prefer to lock it down anyway, I can:

1. Replace the broad SELECT policy with admin-only SELECT
2. Create a new `get_courses_for_member(_tenant_id)` RPC returning `id, name, is_active, pass_mark_percentage, send_certificate_email`
3. Refactor 7 client files to use the RPC instead of direct table reads

This is ~30 mins of work for no real-world security improvement. Say the word if you want it.

## Decision needed

Reply **"dismiss"** (recommended) or **"harden"** (refactor to RPC).
