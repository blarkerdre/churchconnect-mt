## Goal

Collapse the per-channel Email / SMS / WhatsApp tabs in Communications into the existing **Direct Send** flow. After the merge, the Communications page has three tabs:

1. **Announcements** (unchanged)
2. **Direct Send** (admins only — sole place to compose any outbound message)
3. **History** (replaces the per-channel tabs)

Non-admin members get a single **My Messages** tab in place of the current per-channel history views.

## Changes

### `src/pages/Communications.jsx`
- Remove the `email`, `sms`, `whatsapp` `TabsTrigger`s and their `TabsContent` blocks (including the `EmailAlertForm`, `Send Bulk SMS`/`Send Bulk WhatsApp` buttons, and the empty-state cards).
- Drop the now-unused imports/state: `EmailAlertForm`, `smsOpen`, `waOpen`, `smsAnnouncement`, plus the related dialog mounts at the bottom of the file (the bulk SMS/WhatsApp dialogs are now launched only from inside `DirectSendPanel`).
- Add a new **History** `TabsTrigger` (icon: `History` from lucide) visible whenever any of email/sms/whatsapp is enabled. Show the combined unread/scheduled count badge (`emailCount + smsCount + whatsappCount`).
- Add a new **My Messages** `TabsTrigger` for non-admin members (same condition as today's member view of sms/whatsapp tabs, plus email recipients).
- Default tab logic: if user is admin → `announcements`; otherwise → `announcements` (unchanged), but the inner channel selector lives inside History/My Messages.

### New `src/components/comms/CommunicationsHistory.jsx` (admin)
- Renders the existing `ScheduledList` for the selected channel plus a sub-tab/segmented control with `Email | SMS | WhatsApp` (only shows enabled channels).
- Reuses existing `ScheduledList` component as-is (no behavior change). No new queries.

### New `src/components/comms/MyMessagesView.jsx` (members)
- Reuses `MemberSmsListView` for SMS and WhatsApp. For email, reuses whatever component currently surfaces email history to a member (if none exists, omit email here — same as today).
- Segmented control to switch channel; preserves existing `selectedSmsLog` detail dialog wiring.

### `src/components/comms/DirectSendPanel.jsx`
- No structural change — it already supports Email / SMS / WhatsApp / In-App for individual sends and Email/SMS/WhatsApp for bulk non-member sends.
- Minor: ensure the panel is the canonical entry for composing (no other code paths open the bulk SMS/WA dialogs from Communications).

### Cleanup
- `EmailAlertForm` import + usage removed from `Communications.jsx`. Leave the component file in place (still used elsewhere if applicable; otherwise leave for now to avoid scope creep — deletion not required).
- Unit-leader Email composing previously available via `EmailAlertForm` in the Email tab: unit leaders already qualify for `canManageComms`, so they can use Direct Send. No new gating needed.

## Out of Scope
- Renaming "Direct Send" itself.
- Any change to send pipelines, templates, quotas, or RLS.
- Deleting `EmailAlertForm.jsx`, `SMSDialog`, or `WhatsAppDialog` files (they're still mounted/used).
