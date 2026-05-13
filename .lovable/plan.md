The repeated 500 is not caused by the hosted backend being down. The issue is in the function chain:

- `send-testimony` calls `send-email-alert` with the service-role key.
- `send-email-alert` expects a real signed-in user token and rejects the service-role token as `Invalid token`.
- The payload is also incompatible: `send-email-alert` expects `subject` + `body` + audience targeting, while `send-testimony` sends `to` + `html`.

Plan:

1. Update `supabase/functions/send-testimony/index.ts`
   - Validate the caller’s auth token from the request.
   - Confirm the caller belongs to the submitted tenant before saving/sending.
   - Keep tenant-scoped database writes guarded by `tenant_id`.

2. Remove the internal `send-email-alert` call
   - Do not call another protected function for this one-recipient testimony email.
   - Instead enqueue the testimony email directly into the existing transactional email queue using `enqueue_email`, matching the project’s current email infrastructure.
   - Add `email_send_log` rows so delivery can still be tracked.

3. Make errors explicit and non-misleading
   - Return `400` for missing testimony recipient settings or invalid input.
   - Return a clear `403` if the user is not allowed for the tenant.
   - Only return `500` for actual server-side queue/database failures.

4. Validate after implementation
   - Deploy `send-testimony`.
   - Test it with a sample authenticated payload.
   - Confirm it no longer returns `send-email-alert failed: 401 {"error":"Invalid token"}` and instead returns success when the email is queued.

<presentation-actions>
  <presentation-open-history>View History</presentation-open-history>
</presentation-actions>

<presentation-actions>
<presentation-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</presentation-link>
</presentation-actions>