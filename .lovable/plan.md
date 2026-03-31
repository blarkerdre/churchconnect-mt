
Implement reassignment notifications so only the newly assigned follow-up unit member gets direct SMS/email when a follow-up task is reassigned.

1. Confirmed current behavior
- The direct SMS/email path exists only inside `auto_create_followup()`, which runs when a follow-up is first created from member registration/status change.
- The Follow-up detail panel reassigns by updating `followups.assigned_to` directly.
- The `followups` table currently only has an `update_followups_updated_at` trigger, so reassignment does not call the notification function at all.

2. What I’ll build
- Add a new database trigger function for follow-up reassignment notifications.
- Fire it only when `followups.assigned_to` changes to a new non-null user.
- Have it call the existing `notify-followup-assignment` backend function so the same email/SMS logic is reused.

3. Database changes
- Create `public.notify_followup_reassignment()` as a `SECURITY DEFINER` trigger function.
- In that function:
  - exit if `NEW.assigned_to` is null
  - exit if `NEW.assigned_to` is not actually different from `OLD.assigned_to`
  - read `supabase_url` and `email_queue_service_role_key` from vault
  - call `net.http_post(...)` to `/functions/v1/notify-followup-assignment`
  - send `followup_id`, `assigned_to`, and `tenant_id`
- Create trigger:
  - `trg_notify_followup_reassignment`
  - `AFTER UPDATE OF assigned_to ON public.followups`
  - `FOR EACH ROW EXECUTE FUNCTION public.notify_followup_reassignment()`

4. Why this is the right fix
```text
Current:
reassign in UI
  -> update followups.assigned_to
  -> no trigger for reassignment
  -> no notify-followup-assignment call
  -> no email
  -> no sms

After fix:
reassign in UI
  -> update followups.assigned_to
  -> reassignment trigger fires
  -> notify-followup-assignment called
  -> assigned member gets email/sms
```

5. Code impact
- No frontend change needed.
- No new edge function needed.
- Existing `notify-followup-assignment` already handles:
  - contact lookup
  - email queueing
  - SMS send
  - tenant-aware messaging
So the new trigger will plug into the current notification pipeline.

6. Validation after implementation
- Reassign a follow-up from one unit member to another.
- Confirm the backend function is invoked after reassignment.
- Confirm new rows appear in:
  - `email_send_log` with `template_name = followup-assignment`
  - `sms_log` with `sms_type = followup-assignment`
- Confirm only the newly assigned follow-up unit member receives the direct alert.

7. Files changed
- 1 new migration in `supabase/migrations/` to add the reassignment trigger function and trigger

Technical details
- Reuse `net.http_post`, not `extensions.http_post`
- Keep the trigger scoped to reassignment only
- Avoid duplicate sends by checking `NEW.assigned_to IS DISTINCT FROM OLD.assigned_to`
