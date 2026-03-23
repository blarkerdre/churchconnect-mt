

## Add Search Input to Course Registrations

### Change

**`src/pages/ExamManagement.jsx`** — `CourseRegistrationsView`:
1. Add a `searchTerm` state
2. Add an `<Input>` with a search icon next to the source filter dropdown
3. Apply search filter after source filter — match against `first_name`, `last_name`, `email`, and `phone` (case-insensitive)
4. CSV export and count badge already use `filteredRegistrations`, so they'll automatically respect the search

### Technical details
- Add `Search` icon import from lucide-react (already used elsewhere in project)
- Add `Input` import from `@/components/ui/input`
- Filter chain: `registrations → sourceFilter → searchFilter → filteredRegistrations`
- Search matches partial strings across name (first + last combined), email, and phone

