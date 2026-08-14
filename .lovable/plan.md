# Limit "Recorded by" to Training Rep unit members

Today the "Recorded by" dropdown in Training Report lists every user profile in the church. It should only list people who belong to the Training Rep unit.

## What changes

- The dropdown lists only members whose church unit includes "Training Rep" and who have an app account.
- Names are sorted alphabetically.
- If the current user is a Training Rep, they stay pre-selected as today. If the current user is not in the unit (e.g. an admin recording on someone's behalf), they are still shown at the top as "You" so the form can be saved.
- Existing reports recorded by someone no longer in the unit keep displaying that person's name in the table, CSV and print output.

## Technical notes

In `src/pages/TrainingReports.jsx`, replace the `training-recorder-profiles` query (currently a plain `profiles` select) with a tenant-scoped query on `members` filtered by `church_unit ilike '%Training Rep%'` and `user_id not null`, then map those `user_id`s to display names via the existing profiles lookup (kept for `recorderName`/`profileMap` so historical rows still resolve). The `Select` options come from the filtered list plus the current user when missing.
