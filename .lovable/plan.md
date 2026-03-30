

## Change Follow-up Template Delay from Days to Hours

### What changes
Rename and convert the `delay_days` column to `delay_hours` across the database, trigger, and UI so admins can schedule automated follow-up messages in hours instead of days.

### Database migration
- Rename column `delay_days` → `delay_hours` on `followup_message_templates`
- Convert existing values: `UPDATE followup_message_templates SET delay_hours = delay_hours * 24` (since old value of 1 day = 24 hours)
- Update the `auto_create_followup` trigger function to use `_tmpl.delay_hours * interval '1 hour'` instead of `_tmpl.delay_days * interval '1 day'`

### Frontend: `src/components/settings/FollowupTemplatesSection.jsx`
- Rename all `delay_days` references to `delay_hours`
- Update DEFAULT_TEMPLATES: change `delay_days: 1` to `delay_hours: 24` (24 hours = 1 day)
- Badge display: change `Day {t.delay_days}` to `{t.delay_hours}h`
- Edit form label: "Delay (hours after registration)"
- Input max: change from 365 to 8760 (365 days in hours)
- New item default: `delay_hours: 24`

### Files changed
- 1 migration — rename column + update trigger
- `src/components/settings/FollowupTemplatesSection.jsx` — hours UI

