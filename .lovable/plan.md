

## Add Advanced Recipient Filtering to Communications (Date, Status, Unit)

### What changes
Replace the simple audience dropdown in Email, SMS, and WhatsApp with an advanced filtering system that lets users combine:
- **Registration date range** (from/to)
- **Membership status** (Active, First Timer, Inactive, New Convert)
- **Church unit** (from church_units table)

These filters work together (AND logic) to build a precise recipient list before sending.

### Current state
- Audience selection is a single dropdown choosing one unit, one status, or "All Members"
- No date-based filtering exists
- Filters cannot be combined (e.g., "Active members in Choir registered after Jan 2025")

### Design approach
Create a reusable `AudienceFilter` component used by both `EmailAlertForm` and `SMSDialog`. It replaces the single audience dropdown with a filter panel containing:
- Status multi-select or single-select
- Unit dropdown
- Date range (from/to) using Shadcn Calendar+Popover
- Live recipient count preview

The component outputs a filter object `{ status, unit, dateFrom, dateTo }` that the parent uses to query members.

### Files to change

#### 1. `src/components/comms/AudienceFilter.jsx` (new)
- Reusable filter panel with:
  - Status `<Select>` (All / Active / First Timer / Inactive / New Convert)
  - Unit `<Select>` populated from `useChurchUnits()`
  - From/To date pickers (Shadcn Calendar + Popover with `pointer-events-auto`)
  - Live recipient count badge queried from members table
- Accepts `onChange(filters)` callback
- Returns filter object: `{ status: string|null, unit: string|null, dateFrom: Date|null, dateTo: Date|null }`

#### 2. `src/components/comms/EmailAlertForm.jsx`
- Replace the audience `<Select>` with `<AudienceFilter>`
- Pass filter object to `send-email-alert` edge function instead of a single `audience` string
- New payload shape: `{ subject, body, filters: { status, unit, dateFrom, dateTo }, tenant_id }`

#### 3. `src/components/sms/SMSDialog.jsx`
- Replace the audience `<Select>` with `<AudienceFilter>`
- Update member query to use combined filters (status + unit + date range)
- All three filters applied with AND logic

#### 4. `supabase/functions/send-email-alert/index.ts`
- Accept new `filters` object alongside existing `audience` (backward compatible)
- When `filters` is present, build query with:
  - `.eq('membership_status', filters.status)` if set
  - `.ilike('church_unit', '%unit%')` if set
  - `.gte('created_at', filters.dateFrom)` if set
  - `.lte('created_at', filters.dateTo)` if set
- Fall back to existing `audience` logic when `filters` is not provided

### Technical notes
- Date pickers use `pointer-events-auto` on Calendar
- All member queries remain tenant-scoped
- Filters use AND logic (all conditions must match)
- The `AudienceFilter` also keeps "All Members" as a quick preset that clears all filters
- Backward compatible: old `audience` field still works if `filters` is absent

### Files changed
- `src/components/comms/AudienceFilter.jsx` — new shared filter component
- `src/components/comms/EmailAlertForm.jsx` — use AudienceFilter
- `src/components/sms/SMSDialog.jsx` — use AudienceFilter
- `supabase/functions/send-email-alert/index.ts` — support filters object

