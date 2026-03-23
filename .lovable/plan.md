

## Post-Session Demographics & Report — Unit Leaders Only

### Summary
Move demographic recording (male/female/total) and report attachments to appear **only after a session is closed**, accessible **only to unit leaders** (not during session creation). This creates a proper workflow: create session → check-in members → close session → record demographics & upload meeting report.

### Changes

**`src/pages/Attendance.jsx`**

1. **Remove male/female/total inputs from the "New Session" dialog** — these fields should not be filled at creation time
2. **Remove male_count/female_count/total_count from createSessionMutation** — leave them at DB defaults (0)
3. **Add a new "Session Report" section** that appears only when:
   - The selected session is **closed** (`status === "closed"`)
   - The current user is a **unit leader** (`isUnitLeader` — not admin-only, specifically unit leaders)
4. **Session Report section includes:**
   - Editable male/female number inputs with auto-calculated total
   - A "Save Demographics" button that updates the session row
   - The existing `ReportAttachments` component for file uploads
5. **Move ReportAttachments** from its current always-visible position into this new gated section
6. **Demographics display** in the session list and check-ins panel remains read-only for everyone (unchanged)

### Technical Detail
- New `updateDemographicsMutation`: calls `supabase.from("attendance_sessions").update({ male_count, female_count, total_count }).eq("id", sessionId)`
- Gate: `{isClosed && isUnitLeader && ( <SessionReportSection /> )}`
- Local state for demographic editing: `demoForm` with `male_count`/`female_count`, pre-populated from `selectedSession` values when session changes
- No database changes needed — columns already exist

### Files
- `src/pages/Attendance.jsx` (only file)

