

## Add Detail Dialogs to Pastoral Care and Transportation Pages

### Problem
Pastoral care case cards and transportation booking cards show only summary info (subject, member, status, route). Users cannot click to see the full description, notes, resolution details, or booking notes without using the "Manage" action.

### Changes

#### 1. Pastoral Care — Case Detail Dialog (`src/pages/PastoralCare.jsx`)

- Add `detailCase` state (`null` by default)
- Make each case card clickable (`onClick={() => setDetailCase(r)}`) — exclude clicks on the Manage button
- Render a detail dialog at the bottom showing:
  - Subject, care type badge, status badge, confidential indicator
  - Member name
  - Assigned to (from `assigneeMap`)
  - Created date
  - **Full description** (`whitespace-pre-wrap`, no truncation)
  - Resolution notes (if any)
  - Follow-up date (if set)

#### 2. Transportation — Booking Detail Dialog (`src/pages/Transportation.jsx`)

- Add `detailBooking` state (`null` by default)
- Make each booking card clickable (`onClick={() => setDetailBooking(b)}`) — exclude clicks on Manage/Delete buttons
- Render a detail dialog at the bottom showing:
  - Member name, status badge
  - Pickup address and destination
  - Date and pickup time
  - Passengers count
  - Assigned to (from `assigneeMap`)
  - Assigned driver and driver phone
  - **Full notes** (`whitespace-pre-wrap`, no truncation)

### Pattern
Same detail dialog pattern used across Events, Communications, and Follow-ups:
```jsx
<Dialog open={!!detailCase} onOpenChange={(v) => !v && setDetailCase(null)}>
  <DialogContent className="max-w-lg">
    <DialogHeader><DialogTitle>{detailCase?.subject}</DialogTitle></DialogHeader>
    {/* Full content with whitespace-pre-wrap */}
  </DialogContent>
</Dialog>
```

Cards get `cursor-pointer` and the click handler. Action buttons use `e.stopPropagation()` to prevent the detail dialog from opening when clicking Manage/Delete.

### Files changed
- `src/pages/PastoralCare.jsx` — add `detailCase` state, clickable cards, case detail dialog
- `src/pages/Transportation.jsx` — add `detailBooking` state, clickable cards, booking detail dialog

