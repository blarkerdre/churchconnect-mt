## Goal
In the Home Cell report, list cell centres that did **not** record any attendance within the selected date range.

## Changes — `src/components/wsf/WSFAttendanceTab.jsx`

### 1. Compute "non-reporting centres"
Within scope of the current centre + date filters, derive:
- A set of centre IDs that have at least one report in `filteredReports`.
- `nonReportingCentres = availableCentres.filter(c => !reportedIds.has(c.id))` — skipping the loop when `filterCentreId !== "all"` (no list needed for a single centre filter).

### 2. New panel: "Centres With No Report"
Add a card below the Summary stats (only when `filterCentreId === "all"` and there is at least one such centre):
- Title: **Centres With No Attendance Reported** + count badge.
- Helper text: "Within the selected date range" (or "All time" when no dates set).
- Compact list of centre names (with zone label if present). Each row has a small "Record Attendance" button (admin / leader of that centre) that opens the existing dialog pre-selected to that centre.

### 3. CSV + print
Append a second section to both exports listing the non-reporting centres (centre name, zone).

## Out of scope
- No DB changes.
- The existing "Meetings Not Held" estimated stat and the "At cell / Off-venue" filter remain unchanged.
