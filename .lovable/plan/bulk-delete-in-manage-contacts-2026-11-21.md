# Bulk delete in Manage Contacts

## What you'll get
- A tick box next to every contact.
- A "Select all" tick box above the list. It selects every contact that matches your current search, so you can search for a tag and then select all of those.
- Once anything is ticked, a bar appears: "N selected", a **Delete selected** button, and **Clear**.
- Delete selected asks for your account password, the same as every other delete in the app. It says how many contacts will be removed and that this can't be undone.
- After deleting, the list refreshes, the ticks clear, and you see "N contacts deleted".
- The single-contact bin icon works as it does now.

## Technical details
- `ContactsManager.jsx`: add `selected` state (a set of ids) and use the existing `Checkbox` component.
- "Select all" toggles the ids in `filtered`. It shows a part-ticked state when only some are selected. Ticks for contacts that disappear from the list are dropped.
- The bulk mutation deletes in chunks of 200 with `.delete().in("id", chunk).eq("tenant_id", tenantId)`, after `useConfirmDelete()` confirms.
- Each bulk delete writes one `logAudit("contacts_bulk_deleted", ...)` entry with the count.
- No database changes. The existing contact delete permissions apply.
