
## Goal

Let admins send messages to filtered groups of **members** (in addition to existing Individual and Bulk Non-Members flows) from Communications → Direct Send. Filters: membership status, church unit, sex, home cell (WSF centre), and a registered-date range.

## Changes

### 1. `src/components/comms/AudienceFilter.jsx` — extend filters
- Add two new optional filters: `gender` ("all" | "Male" | "Female") and `wsfCentreId` ("all" | centre uuid).
- Fetch active home-cell centres via `wsf_centres` (tenant-scoped) using `useQuery`.
- Include the new fields in `update`, `clearAll`, `hasFilters`, and the live-count query:
  - `if (gender !== "all") q = q.eq("gender", gender)`
  - `if (wsfCentreId !== "all") q = q.eq("wsf_centre_id", wsfCentreId)`
- Render two extra selects ("Sex", "Home Cell") in the existing grid.
- Backward compatible: callers that don't pass these fields keep working ("all" defaults).

### 2. `src/components/comms/DirectSendPanel.jsx` — new Bulk Members mode
- Add a new `BulkMembers` component:
  - Local `filters` state matching AudienceFilter shape (status/unit/gender/wsfCentreId/date/account).
  - Channel select: Email, SMS, WhatsApp, In-App.
  - Subject (email/in-app) + message textarea.
  - Query members matching the filters (same predicates as the live-count, but selecting `id, user_id, first_name, email, phone`). Compute `emailRecipients`, `phoneValid`/`phoneInvalid` (via `normalizePhone`), and `inAppRecipients` (members with `user_id`).
  - Send:
    - Email → loop `send-transactional-email` with `admin-direct-message` (same pattern as `BulkNonMembers`).
    - SMS / WhatsApp → single `send-sms` call with `sms_type: "bulk_member"`, passing `member_id` per recipient.
    - In-App → bulk insert into `notifications` (one row per recipient, type `admin_message`).
  - Show recipient count badge per channel and `InvalidRecipientsPreview` for phone channels.
  - `logAudit("direct_message_sent", "members", null, { mode: "bulk_members", channel, filters, sent, failed }, tenantId)`.
- Add a 4th `TabsTrigger` "Bulk Members" (Users icon) and corresponding `TabsContent`. Update `TabsList` to `grid-cols-4`.

### Out of scope
- No DB/schema/edge-function changes; reuse `send-transactional-email`, `send-sms`, `notifications` table, and the `admin-direct-message` template.
- No changes to History, Announcements, or member-side views.
- No quota or rate-limit changes.
