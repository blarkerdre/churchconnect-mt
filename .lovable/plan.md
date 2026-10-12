# Make member summary cards follow the selected filters

## Cause confirmed

The Members list builds a filtered member set for status, church unit, account, Home Cell and registration dates, but the four summary cards still count the unfiltered member set. This is why **Total, Active, New Converts and First Timers** stay unchanged when filters are selected.

The shared filter also offers **Sex**, but the Members list currently does not apply that selection locally, even though the recipient badge does. This can make the badge, table and cards disagree.

## Fix

- Apply the Sex selection alongside the existing member filters.
- Calculate all four summary cards from the same filtered member set used by the table and CSV download.
- Keep each card's meaning within the filtered audience:
  - **Total:** every matching member.
  - **Active:** matching members whose status is Active.
  - **New Converts:** matching members whose status is New Convert.
  - **First Timers:** matching members whose status is First Timer.
- Include the search box in those totals because it also narrows the visible member list.
- Preserve tenant and leader/unit access restrictions before any audience filter is applied.
- Add a small filter/count logic test covering status, sex, dates, unit, account and Home Cell so the cards cannot drift from the visible list again.

## Verification

- Confirm that changing any Audience Filter immediately updates the table and all four cards.
- Confirm the recipient badge, Total card and visible rows agree when no search text is entered.
- Confirm clearing filters restores the full permitted member totals.
- Run the app checks and confirm it builds successfully.
