## Why it's missing

The Bible School feedback form is stored per tenant in the `wofbi_feedback_forms` table as a JSON list of fields. Your tenant already has a saved form (16 fields) created before the "Testimony Title" field existed. The default field list in code is only used when a form is created or reset, so saved forms never gained the new field.

## Fix

1. **Data migration** — update existing `wofbi_feedback_forms` rows: if the fields JSON has no field with id `testimony_title`, insert one (`type: text`, label "Testimony Title", placeholder "Give your testimony a title") immediately before the `testimony` field. If there is no `testimony` field, append it after the "Your Testimony" section heading, otherwise at the end. Runs once, idempotent, tenant-safe (applies per row).

2. **Safety net in the app** — when the feedback form loads (student dialog and admin editor), merge in any missing default fields that are marked as "core defaults" so future added defaults don't silently skip existing tenants.

## Notes
- Already-submitted feedback responses are unaffected; the Course Final Report already prefers `answers.testimony_title` when present and falls back to the standard heading.
- No schema change — answers and fields are JSON.
