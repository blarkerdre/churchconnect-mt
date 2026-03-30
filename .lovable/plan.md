

## Backfill Missing Visitor Email Template for Existing Tenants

### Problem
The "Visitor / email" default template was added to the code after your tenant already seeded its templates. The "Load Defaults" button only appears when there are zero templates, so it won't trigger again.

### Fix
Run a database migration that inserts the missing Visitor email template for any tenant that has follow-up templates but is missing the Visitor email one.

### Migration SQL
```sql
INSERT INTO followup_message_templates (tenant_id, followup_type, channel, subject, message_template, delay_hours, sort_order, is_active)
SELECT DISTINCT t.tenant_id, 'Visitor', 'email',
  'Thank you for visiting {church}',
  E'Hi {name},\n\nThank you for worshipping with us at {church}! We hope you felt at home and would love to see you again.\n\nWarm regards,\nThe {church} Team',
  24, 1, true
FROM followup_message_templates t
WHERE NOT EXISTS (
  SELECT 1 FROM followup_message_templates t2
  WHERE t2.tenant_id = t.tenant_id AND t2.followup_type = 'Visitor' AND t2.channel = 'email'
);
```

This inserts the template for every tenant that already has templates but is missing the Visitor email entry.

### Files changed
- 1 migration — backfill Visitor email template

