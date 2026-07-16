## Why the filter doesn't work

On the Members page, the Status dropdown comes from `AudienceFilter` (`src/components/comms/AudienceFilter.jsx`), whose `STATUS_OPTIONS` list is:

`Active, First Timer, Inactive, New Convert, Visitor`

"Bible School" is a valid `membership_status` everywhere else (MemberFormDialog, BulkImportDialog, the status color map in Members.jsx), but it's missing from this dropdown — so there's no option to select, and filter matching (`m.membership_status === filters.status`) never gets a "Bible School" value.

## Fix

Add `Bible School` to `STATUS_OPTIONS` in `src/components/comms/AudienceFilter.jsx` so it appears in the Status dropdown on Members (and consistently in Communications audience filters, which use the same component).

```js
{ value: "Bible School", label: "Bible School" },
```

No other changes — filter logic, RLS, and data model already support this status.

## Note

`AudienceFilter` is shared with Communications' `BulkMembersPanel`. Adding "Bible School" there means admins can also target Bible School members in bulk messages, which is consistent with existing status semantics. Confirm if you'd prefer it Members-only (would require decoupling the option list).