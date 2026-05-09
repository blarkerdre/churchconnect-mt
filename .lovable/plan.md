## Continue Birthday Messaging Feature

Two remaining items from the previous implementation:

### 1. Admin "🎂 Send wishes" button on Dashboard birthday list

In `src/components/dashboard/BirthdayCelebration.jsx`, extend `UpcomingBirthdayItem` so that when the viewer is an admin AND the member's birthday is today, a small "Send wishes" button is shown inline.

Behavior:
- Visible only when `isToday` is true and `isTenantAdmin` (read via `useAuth`).
- On click, invokes the existing `send-birthday-messages` edge function with `{ tenant_id, member_id, channels: <enabled channels from settings> }`.
- Disabled + shows "Sent" if today's `birthday_message_log` already has any successful row for that member (queried once per dashboard render via a small TanStack query keyed on `[birthday_message_log, tenant_id, today]`).
- Uses sonner toasts for success/failure.
- Respects the `birthday_message_settings.enabled` flag — if disabled, the button is hidden.

No schema changes needed — the table, log, and edge function already exist.

### 2. Memory entry

Add a new memory file `mem://features/birthday-messages` summarising:
- Tables: `birthday_message_settings`, `birthday_message_log` (idempotency on `tenant_id, member_id, channel, sent_on`).
- Edge function `send-birthday-messages` (hourly cron + manual invoke for test/send-wishes), service-role aware.
- Settings UI lives in Settings → Communications, admin-only.
- Templates support `{first_name}`, `{last_name}`, `{church_name}` placeholders.
- Channels: in_app, email, sms, whatsapp.

Then update `mem://index.md` to reference the new file under Memories.

### Files

- Edited: `src/components/dashboard/BirthdayCelebration.jsx`
- Created: `mem://features/birthday-messages`
- Edited: `mem://index.md`