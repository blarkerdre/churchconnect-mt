

User says Blarkerdre@yahoo.com (a tenant owner) cannot see "Admin" in the role dropdown. Let me check the dropdown markup.

Looking at `TenantUsersDialog.jsx` lines 274-289 — the Select has `member`, `admin`, `owner` as options. So Admin IS in the list. Let me think about what they could mean:

1. The dropdown shows current value but no options when opened? — Unlikely, all three are hardcoded.
2. On mobile (384px viewport — confirmed by current-viewport), the SelectTrigger has class `w-28 h-7 text-xs` — 112px wide, 28px tall. The dropdown opens but might be clipped.
3. Most likely: the **SelectContent dropdown is being clipped/hidden** by the Dialog's `max-h-[85vh] overflow-y-auto` container on mobile. Radix SelectContent uses a Portal by default so it should escape, but the trigger sits in a scrollable area and on small viewports the content can render off-screen or behind.

Actually — re-reading: the `Select` content has 3 items. They should all render. Let me look harder…

The DialogContent has `overflow-y-auto`. Radix Select renders via Portal so it escapes the dialog scroll. That should be fine.

Wait — could it be that for THIS user's row, the current role IS already "admin", so when they open the dropdown they see Member/Admin/Owner with Admin highlighted, but they're looking at it on a 384px viewport where the dropdown is super narrow and "Admin" might be visually obscured?

Or — more likely — the user is looking at OTHER users' rows. Blarker is the owner viewing the list. The dropdown for OTHER users shows current role. He wants to change someone TO admin. The dropdown should show all three options.

Most plausible cause given mobile context: **the SelectTrigger is `w-28` (112px) with `h-7 text-xs`**, and on mobile the SelectContent popover may render but be misaligned or clipped. OR — and I think this is it — the role column is in a `Table` inside `overflow-x-auto`, on a 384px viewport the Actions column pushes the role Select off-screen to the right, or the dropdown content gets clipped at the viewport edge.

Let me check by looking at the table structure — line 263: `<TableCell>` wraps the Select. With User column + Role column + Actions column, on 384px width the table overflows horizontally. User scrolls right to see Role, but the SelectContent portal opens at the trigger's absolute position which might be off-screen.

Actually a much simpler possibility I should not overlook: **the Select component is rendered inside an `AlertDialog` or another nested portal**, but it's not — it's directly in the Dialog. Radix handles this.

I should ask the user to clarify before fixing the wrong thing. There are too many possibilities:
- Does he see a dropdown that opens with only 2 options?
- Does the dropdown open but Admin is cut off?
- Does the dropdown not open at all?
- Is he on mobile or desktop?
- Is he looking at his OWN row (an owner can demote himself to admin)?

## Plan

Ask one targeted clarifying question, then fix.

### Step 1 — Clarify

Use `questions--ask_questions` to ask Blarker (via the user) what he actually sees:
- Dropdown opens but Admin option is missing entirely
- Dropdown opens but Admin appears cut off / hidden behind something
- Dropdown does not open at all when tapped
- He's trying to change his OWN role from Owner to Admin and that option is missing

### Step 2 — Fix based on answer

**If "Admin missing entirely"** — likely means he's viewing an old cached build. Add a hard cache-bust note and verify deploy. Also check if any condition gates the option (currently none — all three are always rendered).

**If "Admin appears cut off / hidden"** — mobile clipping of `SelectContent`. Fix by:
- Widening `SelectTrigger` from `w-28` to `w-full sm:w-28` (or `min-w-[110px]`)
- Adding `position="popper"` and `sideOffset={4}` to SelectContent so Radix smart-flips it into the viewport
- Ensure the `Table`'s `overflow-x-auto` wrapper doesn't trap the portal (it shouldn't, but add `className="z-[60]"` to SelectContent to outrank dialog overlay)

**If "Dropdown does not open"** — likely a click-target issue at `h-7` on touch screens (28px is below the 44px iOS minimum). Bump trigger to `h-9` on mobile.

**If "Trying to change own Owner → Admin"** — this IS allowed currently (no guard prevents owner self-demote). If he doesn't see his own row's dropdown enabled, check if the `disabled` logic on the Select is inadvertently triggered. Currently the Select is never disabled — only the Trash button is, when isOnlyOwner. So this should work. If he's the only owner the typed-confirmation `DEMOTE` will protect him.

### Files (likely to edit)
- `src/components/tenants/TenantUsersDialog.jsx` (mobile dropdown sizing & SelectContent positioning)

### Out of scope
- Database / RLS changes (verified earlier — owners can update roles)
- Any change to confirmation flow

