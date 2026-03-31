

## Remove SMS Reminder from Followups Page

### What changes
Remove the "SMS Reminder" button and its associated `SMSDialog` from the Followups page.

### Changes to `src/pages/Followups.jsx`
1. **Remove state**: `smsFollowup` state variable (line 35)
2. **Remove sub-feature check**: `canSmsFollowup` (line 40)
3. **Remove SMS button**: lines 375-385 (the "SMS Reminder" button in the follow-up card)
4. **Remove SMSDialog block**: lines 443-453
5. **Remove unused imports**: `SMSDialog`, `MessageSquare` (if no longer referenced elsewhere in file)

### Files changed
- `src/pages/Followups.jsx` — remove SMS reminder button and dialog

