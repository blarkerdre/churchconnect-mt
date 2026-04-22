

## Make URLs clickable in Announcements & Events

Right now, only the announcement body inside `AnnouncementCard` auto-linkifies URLs (via a local `renderBodyWithLinks` helper). Everywhere else — the announcement detail dialog in Communications, the announcement item in MemberFeed, the event description in EventCard, the event detail dialog on the Events page, and the event detail in MemberFeed — URLs are rendered as plain text and aren't clickable.

This change extracts the helper into a shared util and uses it everywhere announcement bodies and event descriptions are displayed.

### Changes

#### 1. New shared util — `src/lib/linkify.jsx`

Move the existing logic out of `AnnouncementCard` into one place:

```jsx
// Splits text on http(s) URLs and renders matches as <a target="_blank" rel="noopener noreferrer">
export function renderTextWithLinks(text) { … }
```

- Same regex used today: `/(https?:\/\/[^\s]+)/g`.
- Links open in a new tab, styled with `text-primary underline hover:text-primary/80` (matches the project's link styling used in `useConsentText.jsx`).
- Trims trailing punctuation that commonly follows URLs in prose (`. , ; : ) ]`) so they aren't included in the link target — small UX polish.
- Safe by default: it only renders the matched URL string as the link text/href; no `dangerouslySetInnerHTML`, preserving the existing XSS posture.

#### 2. Replace local helper in `AnnouncementCard.jsx`

- Remove the inline `renderBodyWithLinks` function.
- Import and use `renderTextWithLinks` from `@/lib/linkify` for `announcement.body` (line 109). Behaviour stays identical.

#### 3. Linkify announcement body in the Communications detail dialog

`src/pages/Communications.jsx` line 756 — wrap `selectedAnnouncement.body` with `renderTextWithLinks(...)`.

#### 4. Linkify announcement content in the Member Feed

`src/components/profile/MemberFeed.jsx`:
- Line 84: `{a.content}` → `{renderTextWithLinks(a.content)}`
- Lines 437–485 (announcement detail dialog body — confirm exact line during implementation): same treatment.

#### 5. Linkify event descriptions everywhere they render

- `src/components/events/EventCard.jsx` line 42: card preview (still wrapped in `line-clamp-2`, so links inside the visible portion will be clickable; clipped portions naturally aren't — acceptable).
- `src/pages/Events.jsx` line 551: event detail dialog body.
- `src/components/profile/MemberFeed.jsx` line 206 (feed inline expanded view) and line 484 (event detail dialog body).

All five sites preserve their existing `whitespace-pre-wrap` / `leading-relaxed` styling — only the inner text rendering changes from a raw string to the linkified node array.

### What the user sees

- Pasting `https://winners-chapel.org/livestream` into an announcement body or event description now renders as a blue underlined clickable link in:
  - Announcement cards on the Communications page
  - Announcement detail dialog
  - Event cards on the Events page (within the 2-line preview)
  - Event detail dialog
  - The "My Feed" widget on the dashboard (both inline expansion and the popped-out detail dialog)
- Clicking opens the link in a new tab.
- Plain text without URLs is unchanged.
- No new XSS surface: text is still rendered as React children, not HTML.

### Acceptance checks

1. Create an announcement whose body contains "Join us at https://example.com tomorrow." — the URL is a clickable blue link in the announcement card, the Communications detail dialog, and the MemberFeed (inline + dialog).
2. Create an event whose description contains a URL — the link is clickable in the event card, the Events page detail dialog, and both MemberFeed surfaces.
3. Trailing punctuation (`https://example.com.`) links to `https://example.com` (period excluded), with the period rendered as plain text.
4. Body text without URLs renders identically to today (no spurious tags, line breaks preserved).
5. No regressions in announcement/event reactions, registration buttons, or print/CSV exports (none of those touch this code path).

### Files touched

- **New**: `src/lib/linkify.jsx`
- **Edited**: `src/components/comms/AnnouncementCard.jsx`, `src/pages/Communications.jsx`, `src/components/profile/MemberFeed.jsx`, `src/components/events/EventCard.jsx`, `src/pages/Events.jsx`

