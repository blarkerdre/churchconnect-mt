

## Add Granular Sub-Feature Toggles

### Overview
Extend the existing feature toggle system so Super Admins can disable specific components (sub-features) within each feature module -- not just the entire page. For example, disable "Bulk Import" within Members, or "SMS" within Communications, while keeping the rest of the feature active.

### Approach
Store a new `app_settings` key `disabled_sub_features` as a JSON array of string identifiers (e.g. `"members.bulk_import"`, `"communications.sms"`). Each feature page checks this list to conditionally hide specific buttons, tabs, or sections.

### Sub-Features per Module

| Feature | Toggleable Components |
|---|---|
| **Members** | Bulk Import, Registration QR Code, Issue Certificate, Add Member |
| **Events** | Create Event, SMS Attendees, Recurring Events |
| **Communications** | Announcements, Email Alerts, SMS, WhatsApp |
| **Follow-ups** | Create Follow-up, SMS Follow-up |
| **Pastoral Care** | Create Request, Assign Cases |
| **Transportation** | Create Booking |
| **Analytics** | Absence Alerts, Trends, Consistency |
| **Training Reports** | Print Report, CSV Export, Attachments |
| **Church Attendance** | Record Attendance |
| **WoFBI** | Create Course, Take Exam, Registration QR |
| **WSF Centres** | Create Centre, Record Attendance |
| **Dashboard** | Self Check-In Widget, Book of the Month |

### Changes

1. **`src/hooks/useSubFeature.js`** (new)
   - Simple hook: `useSubFeature(key)` returns `{ enabled: boolean }`
   - Reads from `useAppSetting("disabled_sub_features", [])`
   - Returns `enabled: !disabledList.includes(key)`

2. **`src/pages/Settings.jsx`** -- Expand Feature Toggles section
   - Below each feature toggle, add an expandable list of sub-feature toggles
   - Each sub-feature has its own Switch, stored in `disabled_sub_features`
   - Only shown when the parent feature is enabled
   - Collapsible per feature to keep the UI clean

3. **Update all feature pages** to wrap toggleable components:
   - `Members.jsx` -- hide Bulk Import button, QR button, Certificate button based on sub-feature keys
   - `Events.jsx` -- hide Create Event button, SMS button
   - `Communications.jsx` -- hide SMS tab, WhatsApp tab, Email tab
   - `Followups.jsx` -- hide Create button, SMS button
   - `PastoralCare.jsx` -- hide Create Request, Assign
   - `Transportation.jsx` -- hide Create Booking
   - `Analytics.jsx` -- hide sub-sections
   - `TrainingReports.jsx` -- hide Print, CSV, Attachments
   - `ExamManagement.jsx` -- hide Create Course, QR
   - `WSFManagement.jsx` -- hide Create Centre, Attendance
   - `Dashboard.jsx` -- hide Self Check-In, Book of the Month
   - `ChurchAttendance.jsx` -- hide Record button

### Technical Details

- Sub-feature keys follow `"parent.component"` naming (e.g. `"members.bulk_import"`)
- The hook is a thin wrapper over `useAppSetting` so it shares the same query cache
- Super admins always see all sub-features regardless of toggle state (same pattern as feature toggles)
- No database migration needed -- uses existing `app_settings` table with a new key

### Sub-Feature Registry (used in Settings UI)

```javascript
const SUB_FEATURES = {
  "/members": [
    { key: "members.add_member", name: "Add Member" },
    { key: "members.bulk_import", name: "Bulk Import" },
    { key: "members.qr_code", name: "Registration QR Code" },
    { key: "members.certificate", name: "Issue Certificate" },
  ],
  "/events": [
    { key: "events.create", name: "Create Event" },
    { key: "events.sms", name: "SMS Attendees" },
  ],
  // ... etc for all features
};
```

