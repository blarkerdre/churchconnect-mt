

## Add Visitor Email to Default Follow-up Templates

### What changes
Add a default "Visitor" email template to `DEFAULT_TEMPLATES` in `src/components/settings/FollowupTemplatesSection.jsx`.

### Change
**`src/components/settings/FollowupTemplatesSection.jsx`** — Add one more entry to `DEFAULT_TEMPLATES`:
```js
{ followup_type: "Visitor", channel: "email", subject: "Thank you for visiting {church}", 
  message_template: "Hi {name},\n\nThank you for worshipping with us at {church}! We hope you felt at home and would love to see you again.\n\nWarm regards,\nThe {church} Team", 
  delay_hours: 24, sort_order: 1 }
```

### Files changed
- `src/components/settings/FollowupTemplatesSection.jsx` — add Visitor email default template

