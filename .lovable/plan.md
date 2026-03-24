

## Hide "Inactive" from All Form Dropdowns

Remove "Inactive" as a selectable option across all forms and filters while keeping it valid for display purposes (badges, analytics, etc.).

### Files to Change

1. **`src/components/members/MemberFormDialog.jsx`** (line 23)
   - Remove "Inactive" from the `STATUSES` array used in the membership status dropdown

2. **`src/pages/Members.jsx`** (line 162)
   - Remove the `<SelectItem value="Inactive">Inactive</SelectItem>` from the status filter dropdown

3. **`src/pages/PublicRegistration.jsx`** (line 17)
   - Remove "Inactive" from the `STATUSES` array

4. **`src/pages/MyProfile.jsx`** (line 23)
   - Remove "Inactive" from the `MEMBERSHIP_STATUSES` array

5. **`src/components/members/BulkImportDialog.jsx`** (line 16)
   - Remove "Inactive" from the `VALID_STATUSES` array

### What stays unchanged
- Status badge colors/display (MemberTable, MemberJourneyTimeline, MemberDashboard, Analytics) — these just render existing data and should continue showing "Inactive" for members already marked as such
- The exams/subjects "Inactive" badge — this is unrelated (refers to exam/subject active state)

