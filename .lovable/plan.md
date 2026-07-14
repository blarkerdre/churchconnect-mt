# Fix hardcoded church name in Bible School registration email

## Problem
The Bible School (WoFBI) course registration email always shows "Winners Chapel International Cardiff" in the header and footer — even when sent from Demo Church or any other tenant. The tenant name is hardcoded in the email template.

## Root cause
`supabase/functions/_shared/email-templates/wofbi-course-registration.tsx` literally hardcodes the string `Winners Chapel International Cardiff` in both the header banner and the footer. The sender function `send-course-registration-email/index.ts` already looks up the tenant's display name (as `senderName`, from `tenants.settings.email_sender_name` or `tenants.name`), but never passes it into the template's props.

## Changes

1. **`supabase/functions/_shared/email-templates/wofbi-course-registration.tsx`**
   - Add `tenantName?: string` to `WoFBICourseRegistrationEmailProps`.
   - Replace the two hardcoded `Winners Chapel International Cardiff` strings (header and footer) with `{tenantName || 'Your Church'}`.
   - Keep the "Bible School" suffix wording in the footer.

2. **`supabase/functions/send-course-registration-email/index.ts`**
   - Pass `tenantName: senderName` into `templateProps` so the already-resolved tenant display name flows into the template.
   - No other logic changes — auth, unsubscribe token, logging, and send flow all stay the same.

3. **Deploy** the `send-course-registration-email` function after the edit so the change goes live.

## Out of scope
- No DB/schema changes.
- No changes to other Bible School emails (exam-ready, results, etc.) — those already use `tenantName` correctly.
- No branding/logo changes.
