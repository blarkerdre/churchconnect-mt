

## Add Member Filters: Registration Date, Status, Unit, and Account

### What changes
Add four filters to the Members page so admins/leaders can filter the member list by:
1. **Status** — expand existing dropdown to include Inactive and Visitor
2. **Church Unit** — new dropdown populated from `church_units` table
3. **Registration Date** — from/to date pickers filtering by `created_at`
4. **Account** — Linked (has `user_id`) / Unlinked (no `user_id`)

### Approach
Replace the current single status `<Select>` (lines 146-158) with the reusable `<AudienceFilter>` component that already exists, extended with an **Account** filter. This keeps the Members page consistent with Communications filtering.

### Files to change

#### 1. `src/components/comms/AudienceFilter.jsx`
- Add `account` to filter state: `"all"`, `"linked"`, `"unlinked"`
- Add Account `<Select>` dropdown (All / Linked / Unlinked)
- Update `hasFilters`, `clearAll`, and live count query to include account filter
- Count query: `linked` → `.not("user_id", "is", null)`, `unlinked` → `.is("user_id", null)`

#### 2. `src/pages/Members.jsx`
- Import `AudienceFilter` and replace the status `<Select>` with `<AudienceFilter>`
- Add state: `filters = { status: "all", unit: "all", dateFrom: null, dateTo: null, account: "all" }`
- Remove the old `statusFilter` state
- Update `filtered` logic (line 92-96) to also check:
  - `unit`: member's `church_unit` contains selected unit
  - `dateFrom`/`dateTo`: `created_at` falls within range
  - `account`: `user_id` is set or null
- All filtering remains client-side (members already fetched)

### Technical notes
- Reuses existing `AudienceFilter` component and `useChurchUnits` hook
- No database changes needed
- The recipient count badge in `AudienceFilter` will show filtered count on Members page too
- Date pickers use `pointer-events-auto` (already implemented)

