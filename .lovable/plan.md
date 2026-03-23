

## Add Source Filter to Course Registrations

### Change

**`src/pages/ExamManagement.jsx`** — `CourseRegistrationsView`:
1. Add a `sourceFilter` state: `"all" | "member" | "public"`
2. Add a `Select` dropdown next to the CSV button (options: All, Member, QR / Public)
3. Filter the `registrations` array before rendering based on the selected source
4. Apply the same filter to the CSV export so downloads match the current view
5. Update the count badge to reflect filtered results

### Technical details
- Filter logic: `"member"` → `r.members?.user_id != null`, `"public"` → `r.members?.user_id == null`
- Uses existing `Select` component from `@/components/ui/select`
- No database or migration changes needed

