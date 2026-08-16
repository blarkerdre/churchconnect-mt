# Fix "Generate Follow-up Report" layout on small screens

The Generate Follow-up Report dialog (opened from Follow-ups) doesn't fit phone screens. Causes found in `src/components/followups/FollowupReportDialog.jsx`:

- The dialog uses `max-w-6xl` with no small-screen width cap, so on a 384px viewport it hugs/overflows the edges instead of insetting.
- The preview table has 9 columns rendered with `w-full text-xs`; columns get crushed and long text (notes, names) wraps into unreadable slivers.
- The footer stacks three buttons in a single row, pushing content past the edge.
- Summary stat cards (6 across) show clipped labels at the smallest width.

## What will change

1. **Dialog shell** — add `w-[calc(100vw-1.5rem)] sm:w-full` and safer padding so it insets on phones; keep `max-w-6xl` on desktop.
2. **Filters** — already a 1/2/3-column grid; tighten gaps and ensure select triggers can shrink (`min-w-0`).
3. **Summary cards** — 2 columns on phones with tighter padding and smaller label text so no label clips.
4. **Preview table** — set a `min-w` on the table inside the existing scroll container so columns keep readable widths and the region scrolls horizontally instead of crushing; add `whitespace-nowrap` on short cells and a clamp on the notes column. Keep sticky header.
5. **Footer** — stack buttons full-width on phones, inline from `sm:` up.

No changes to the data, filters logic, CSV, or print output.

## Verification

Open the dialog at 384px via a Playwright check and confirm the page/dialog width matches the viewport with no horizontal page scroll, and the table scrolls inside its own container.
