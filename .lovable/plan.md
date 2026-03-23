

## Auto-populate WSF Centre Address from House Provider

When a House Provider (member) is selected in either WSF centre form, automatically populate the address, postcode, and city fields from that member's record.

### Changes

**1. `src/components/settings/WSFCentresSection.jsx`**
- Expand the `allMembers` query to include `address, postcode, city` fields
- When `host_member_id` changes in the form, look up the selected member and auto-fill `address`, `postcode`, `city` fields
- Fields remain editable (user can override after auto-fill)

**2. `src/components/wsf/WSFCentreFormDialog.jsx`**
- Expand the `allMembers` query to include `address, postcode, city` fields
- Add a `useEffect` or handler: when `host_member_id` changes, auto-populate `address`, `postcode`, `city` from the selected member
- Fields remain editable after auto-fill

### Technical Detail
- Both components already query `members` for the host dropdown — just add `address, postcode, city` to the `.select()` call
- On host member change: `const m = allMembers.find(x => x.id === selectedId); set("address", m.address || ""); set("postcode", m.postcode || ""); set("city", m.city || "");`
- No database changes needed — `wsf_centres` already has `address`, `postcode`, `city` columns

