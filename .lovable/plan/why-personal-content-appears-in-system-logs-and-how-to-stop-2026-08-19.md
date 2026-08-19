# Why personal content appears in System Logs — and how to stop it

## What's happening

When full audit logging was rolled out across every module, a single database trigger (`audit_row_change`) was attached to ~83 tables. For each create/update/delete it stores a complete **before** and **after** copy of the row in the audit entry.

That copy includes every column, so free-text and personal content is being written into the log verbatim. Confirmed in the live data: sermon note entries store the entire note body, e.g. a note titled "Global Midweek Charge" with its full HTML content and speaker name.

The trigger only redacts columns whose names match PIN, token, secret, password, hash, or API key patterns. Everything else — note content, testimony text, pastoral care notes, feedback answers, message bodies, member profile fields — is stored in full.

Who can see it: super admins, and tenant admins for their own church. So a church admin can currently read members' private sermon notes, testimonies and pastoral care notes through System Logs → Audit, even where they have no access to those records in the feature itself.

## Proposed fix

Keep the audit trail (who changed what, when) but stop storing the personal content itself.

### 1. Content-column redaction in the audit trigger

Extend `audit_row_change` with a sensitive-column list that is recorded as a change marker rather than a value. Instead of the text, store `"[content changed]"` (or `"[content]"` on create/delete) so the diff still shows *that* the field changed without exposing what it said.

Columns to redact by name pattern:
`content`, `body`, `notes`, `note`, `message`, `description`, `answer`, `answer_text`, `response`, `response_text`, `comment`, `testimony`, `prayer_request`, `details`, `feedback`, `reason`, `address`, `medical_notes`, `allergies`, `special_needs`.

### 2. Fully excluded tables

Some tables are personal-content-only, where even a field-level diff has little audit value but high privacy cost. Log create/delete events with identifiers only (no before/after payload) and skip content diffs entirely:

- `sermon_notes` (private, cross-church personal library)
- `testimonies`
- `pastoral_care`
- `messages`
- `wofbi_feedback_responses`
- `lecturer_ratings` (anonymous student feedback)
- `app_feedback`

### 3. Clean up existing log entries

One-off cleanup pass over `audit_log` that rewrites already-stored `details.before` / `details.after` for the affected tables, replacing sensitive values with the same redaction markers. Row count, actor, timestamp and entity references stay intact so the trail is unbroken.

### 4. System Logs display

`src/pages/SystemLogs.jsx` renders redaction markers plainly — e.g. "Content: changed (hidden)" — rather than printing the literal `[content changed]` string, so the audit tab reads naturally.

## What stays the same

- Every action is still logged: who, when, which module, which record, and which fields changed.
- Non-sensitive field diffs (status, dates, category, assignment, amounts, flags) remain fully visible.
- Existing filters, expandable diffs and CSV export are unchanged.
- Secret redaction (PINs, tokens, keys) is unchanged.

## Technical notes

- One migration: `CREATE OR REPLACE FUNCTION public.audit_row_change()` with the added sensitive-column matcher and the excluded-table list. Triggers themselves do not need re-attaching.
- The cleanup is an `UPDATE` on `audit_log`; `audit_log` currently blocks modification via `audit_log_block_modify`, so the cleanup runs inside the migration with that trigger temporarily disabled and re-enabled in the same transaction.
- Client changes limited to `src/pages/SystemLogs.jsx` label rendering.
- No RLS or grant changes; visibility rules for the audit tab are untouched.
