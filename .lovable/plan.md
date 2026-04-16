

## Restrict Leader Communications to Their Own Members

### Problem
Currently, Unit leaders and Home Cell leaders can access the communications UI but can send emails/SMS/WhatsApp to ALL members via the audience filters. They should only be able to communicate with members in their assigned unit(s) or Home Cell centre(s).

### Changes

**1. `src/components/comms/AudienceFilter.jsx` — Restrict unit dropdown for leaders**
- Accept a `restrictedUnits` prop (array of unit names)
- When provided, only show those units in the unit dropdown (remove "All Units" option)
- Auto-select the first restricted unit if only one is available
- The recipient count query will naturally scope to the selected unit

**2. `src/components/comms/EmailAlertForm.jsx` — Pass leader scope**
- Accept a `restrictedUnits` prop and forward it to `AudienceFilter`
- When `restrictedUnits` is provided, auto-set the unit filter to the first unit on mount

**3. `src/components/sms/SMSDialog.jsx` — Pass leader scope**
- Accept a `restrictedUnits` prop and forward it to `AudienceFilter`
- Auto-set the unit filter similarly

**4. `src/pages/Communications.jsx` — Wire up leader scoping**
- Compute `leaderRestrictedUnits`: for non-admin unit leaders, use `leaderUnits`; for non-admin WSF leaders, use `wsfLeaderCentres`; combine both if user has both roles
- Pass `restrictedUnits` to `EmailAlertForm` and both `SMSDialog` instances
- Admins continue to see all units (no restriction)

### How it works
- Unit leader for "Choir" → unit dropdown only shows "Choir", sends only to Choir members
- WSF leader for "Zone A Centre" → unit dropdown only shows "Zone A Centre"
- Leader with multiple units → dropdown shows only their units
- Admin → no restriction, sees all units as before

### Files Changed
- `src/components/comms/AudienceFilter.jsx` — add `restrictedUnits` prop
- `src/components/comms/EmailAlertForm.jsx` — accept and forward `restrictedUnits`
- `src/components/sms/SMSDialog.jsx` — accept and forward `restrictedUnits`
- `src/pages/Communications.jsx` — compute and pass leader restrictions

