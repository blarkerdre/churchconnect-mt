## Why Reports Officer sees an empty Reports tab in Analytics

In `src/pages/Analytics.jsx`, the three reports under the **Reports** tab are gated behind `isAdmin`:

```jsx
{isAdmin && <MemberMilestoneReport />}
{isAdmin && <StatusConversionReport />}
{isAdmin && <FeedbackSummary />}
```

Reports Officer passes the route guard (`ReportsRoute` allows `isReportsOfficer`), so they land on the page, but the Reports tab renders nothing for them. The Overview tab works fine because it's not gated.

## Fix

Allow Reports Officer to view (read-only) the report content, while keeping the bulk-messaging actions admin-only (memory: milestone/conversion reports are admin-only for messaging).

**`src/pages/Analytics.jsx`**
- Pull `isReportsOfficer` from `useAuth`.
- Change the gates to `{(isAdmin || isReportsOfficer) && <MemberMilestoneReport />}` etc.
- Leave Announcements tab admin-only (no change).

**`src/components/analytics/MemberMilestoneReport.jsx`**
- Read `isAdmin` from `useAuth`.
- Hide the "Message …" buttons (lines ~588, 596, 615) when `!isAdmin` so Reports Officers can view rosters/metrics but cannot trigger messaging. Keep CSV Download available.

**`src/components/analytics/StatusConversionReport.jsx`**
- Same pattern: hide the "Message N Members" button (line ~279) when `!isAdmin`.

**`src/components/feedback/FeedbackSummary.jsx`**
- No admin-only actions detected; render as-is for Reports Officer.

## Out of scope
- No RLS / backend changes (Reports Officer already has read access via RLS for these tables).
- No changes to Overview tab or other modules.
