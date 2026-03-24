

## Fix Automatic Follow-up SMS to Assigned Person

### Problem
The `auto_create_followup` database trigger tries to call the `notify-followup-assignment` edge function via `http_post`, but the vault secret `supabase_url` is missing. This means the trigger silently skips the notification call, so no SMS (or email) is sent to the assigned person.

### Solution

**Step 1: Add the missing vault secret**
- Insert `supabase_url` into the Supabase vault so the trigger can construct the edge function URL.
- SQL migration: `SELECT vault.create_secret('https://komqiadgeaapeuuzbovn.supabase.co', 'supabase_url');`

**Step 2: Verify the SMS message content**
The `notify-followup-assignment` edge function already sends a personalized SMS directed to the assigned person:
> "Hi {name}, you've been assigned a new follow-up task for {member_name}. Please check the Church Management System. - Winners Chapel Cardiff"

This is already correct and directed at the assigned person. No code changes needed.

**Step 3: Test end-to-end**
- Register or update a member to "First Timer" or "New Convert" status
- Verify the trigger fires, calls the edge function, and an SMS log entry appears

### Technical Details
- **File changes**: None -- only a vault secret insertion via migration
- **Root cause**: The trigger checks `IF _supabase_url IS NOT NULL AND _service_key IS NOT NULL` before calling `http_post`. Since `supabase_url` is NULL, the notification is skipped silently.

