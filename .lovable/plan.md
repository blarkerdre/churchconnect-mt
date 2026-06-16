## Move Bulk Members to top-level Communications tab

### Goal
Move the "Bulk Members" send tab out of `DirectSendPanel` and make it a standalone top-level tab in `Communications.jsx`, positioned right after "Direct Send".

### Changes

#### 1. Extract `BulkMembers` into standalone component
- **New file:** `src/components/comms/BulkMembersPanel.jsx`
- Move the `BulkMembers` function (lines ~438-601) and all its dependencies from `DirectSendPanel.jsx` into this new file.
- Export as default `BulkMembersPanel`.

#### 2. Update `DirectSendPanel.jsx`
- Remove the `BulkMembers` function and its local state entirely.
- Remove `AudienceFilter` and `UsersRound` imports (no longer needed here).
- Change `TabsList` from `grid-cols-4` back to `grid-cols-3`.
- Remove the "Bulk Members" `TabsTrigger` and `TabsContent`.
- Remaining tabs: Individual | Bulk Non-Members | Manage Contacts.

#### 3. Update `Communications.jsx`
- Import `BulkMembersPanel`.
- Add new top-level tab "Bulk Members" (with `UsersRound` icon) between "Direct Send" and "History".
- Add corresponding `TabsContent value="bulk-members"` that renders `<BulkMembersPanel senderName={...} />`.
- Only visible to admin (`isAdmin` check), same as Direct Send.

### No database or API changes
Reuse existing `send-transactional-email`, `send-sms`, `notifications` table, and `AudienceFilter` component. No edge function or schema changes required.