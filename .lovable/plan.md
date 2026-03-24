

## Support Multiple Books of the Month

### What Changes
Update the dashboard `BookOfTheMonth` component to fetch and display **all** active books for the current month instead of just one.

### Changes

**`src/components/dashboard/BookOfTheMonth.jsx`**
- Change query from `.maybeSingle()` to `.select("*")` returning an array
- Update heading to "Books of the Month" (plural) when multiple
- Render each book as a card in a vertical stack
- Return `null` if the array is empty

No database or settings changes needed — the table already supports multiple books per month and the admin form already allows adding multiple.

