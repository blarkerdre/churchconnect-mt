

## Add Event Detail Dialog on Events Page

### Problem
Event cards on the Events page show truncated descriptions (`line-clamp-2` in EventCard, no description shown at all in the inline Events.jsx list). Clicking an event has no detail view — users can't see the full description, mode, audience, capacity, or registration info.

### Solution
Add a detail dialog in `src/pages/Events.jsx`. Clicking the event card body (title or content area) opens a Dialog showing all event details.

### Changes to `src/pages/Events.jsx`

1. Add `selectedEvent` state
2. Make the card content area clickable (`cursor-pointer`, `onClick` sets `selectedEvent`)
3. Use `e.stopPropagation()` on action buttons (Edit, Delete, SMS) to prevent dialog from opening
4. Render a Dialog at the bottom showing:
   - Title, category badge, status badge, mode badge, recurring badge, audience badge
   - Full description (`whitespace-pre-wrap`, no truncation)
   - Date and end date
   - Start/end time
   - Location
   - Event mode (In Person / Online / Hybrid)
   - Registration info (count, capacity)
   - Audience

### Files changed
- `src/pages/Events.jsx` — add `selectedEvent` state, clickable cards, and event detail dialog

