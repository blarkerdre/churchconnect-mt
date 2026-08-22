# Fix: follow-up SMS and emails are not being sent

## What's actually happening

Follow-up messages are being saved correctly — 112 of them are sitting in the queue (60 email, 52 SMS), the newest scheduled 17 Aug. Nothing has actually been delivered since 25 May.

The background job that sends them still runs every 5 minutes, but every single call it makes is being rejected: the last 2 hours show 48 responses of `403 Forbidden`. The job authenticates with a service key that was copied into the schedule when it was first created, and that key no longer matches the current one (keys were rotated since). So the sender refuses the request and the queue never drains. Messages stay stuck as "scheduled" — they never even reach a "failed" state, which is why there is no error shown in the app.

The scheduled-communications job uses the same hardcoded-key pattern and is failing the same way.

## The fix

1. Reschedule both background jobs (follow-up messages and scheduled communications) so they read the current service key from secure storage at run time instead of using a copy frozen into the schedule. Rotations will no longer break them.
2. Verify the next run returns success and the backlog starts draining.
3. Decide what to do with the 112 stuck messages (see question below) — either let them send now, or mark the oldest as cancelled and send only recent ones.
4. Add a small safety net: messages that stay queued far past their scheduled time get flagged as failed with a clear reason, so this shows up in the app instead of silently stalling.

## Technical detail

- `cron.job` entries `process-scheduled-followups` and `process-scheduled-communications` embed a literal `Authorization: Bearer <service key>`; the edge functions compare the bearer against `SUPABASE_SERVICE_ROLE_KEY` and return 403 on mismatch.
- Reschedule via `cron.alter_job`/`cron.schedule` using `vault.decrypted_secrets` (the same pattern the email queue uses) to build the header, so no key literal lives in the job body.
- Backlog handling is a one-off UPDATE on `followup_scheduled_messages` / scheduled communications.
- Stale-detection: mark rows still `scheduled` more than 24h past `scheduled_at` as `failed` with an explanatory `error_message`.

## Question

The 112 queued messages date back to mid-August. Sending them all now would deliver messages people were meant to get days ago. Preference: send everything, send only the last 7 days and cancel the rest, or cancel the whole backlog and only send new messages from now on?
