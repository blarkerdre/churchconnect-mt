# Resend DLQ'd Birthday Emails

The sender domain `notify.app.churchmanagementsuite.org` is now **Verified**, so the original failures (`403 domain_not_verified`) won't recur. Two birthday emails are stuck in DLQ and need to be re-sent.

## Affected recipients

| Member | Email | Birthday | DLQ'd on |
|---|---|---|---|
| Ubani Audu | ubanibling@gmail.com | 26 Jun | 26 Jun 07:00 |
| Kennedy Ndukwe | kennedarean@yahoo.com | 25 Jun | 25 Jun 07:00 |

## Approach

Invoke the existing `send-birthday-messages` Edge Function once per member in manual mode. Manual mode (`member_id` in body) bypasses today's-birthday filter and the idempotency log, so it will actually send even though the birthday date has passed and a (failed) log row already exists.

Steps:
1. Call `send-birthday-messages` with `{ tenant_id, member_id: <Ubani's id>, channels: ["email"] }`.
2. Call `send-birthday-messages` with `{ tenant_id, member_id: <Kennedy's id>, channels: ["email"] }`.
3. Query `email_send_log` for these recipients to confirm new rows show `status = sent`.
4. Update the two original DLQ rows' status (optional housekeeping) — or leave them as historical record of the original failure.

No code changes. No migrations. Pure operational re-send via the existing manual-send path already used by the admin "Send wishes" button.

## Out of scope

- Building a generic "Replay DLQ" admin UI (can be a follow-up if you want one).
- Changing birthday-send logic.
