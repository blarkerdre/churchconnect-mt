

## Make the notifications list scrollable

### Problem
On the bell dropdown (NotificationBell), once a user has more than ~5–6 notifications the list runs off the bottom of the popover and the items beyond it can't be reached. Scrolling the page doesn't help because the popover is a floating overlay. On a 384px-wide phone viewport the issue is especially obvious — the list just clips.

### Root cause
`NotificationBell.jsx` wraps the list in:

```text
<ScrollArea className="max-h-80"> … </ScrollArea>
```

Radix `ScrollArea` only scrolls when its **Root** element has a *definite* height. `max-h-80` on its own does nothing here because the Root has no parent constraining it, so it just grows to fit the children and the inner viewport (`h-full w-full`) ends up the full content height. Result: nothing ever overflows, nothing ever scrolls.

The dialog that opens when you tap a single notification has the same risk for very long messages — the message uses `whitespace-pre-wrap` with no scroll container, so a long message can push the action buttons off-screen on small phones.

### Fix

1. **Bell popover list — make it actually scroll**
   - Change `<ScrollArea className="max-h-80">` to `<ScrollArea className="h-[60vh] max-h-96">`.
     - `h-[60vh]` gives the Root a definite height (60% of viewport) so the inner viewport can overflow and the scrollbar appears.
     - `max-h-96` caps it at 384px on tall desktop screens so it doesn't dominate the screen.
   - Keeps `w-80` popover width unchanged.

2. **Notification detail dialog — scroll long messages**
   - In the same file, give the message paragraph a max height + overflow:
     - Wrap the `{selected?.message}` paragraph in a container with `max-h-[50vh] overflow-y-auto pr-1` so very long announcements/decline-reason notifications don't push the Delete / View buttons off the screen on a 671px-tall phone viewport.

### Files touched
- `src/components/notifications/NotificationBell.jsx` — two small className changes (lines ~197 and ~254-258). No logic, query, RLS, or dependency changes.

### Verification
1. Sign in as a user with 10+ notifications, open the bell on the 384×671 mobile preview → list shows a scrollbar and you can scroll all the way to the oldest notification.
2. Same on desktop — list caps at 384px tall, scrollbar appears past that.
3. Open a notification with a very long message (e.g. an announcement) → message area scrolls inside the dialog, Delete and View buttons remain visible at the bottom.
4. Mark-all-read, delete-from-row, and click-to-open-dialog behaviour all still work.

