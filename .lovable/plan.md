
## Root cause (found it)

`FollowupDetailPanel` is a hand-rolled slide-over at `z-[55]` (with its own `bg-black/30` backdrop). `SignPostDialog` uses Radix Dialog whose default overlay AND content are at `z-50`. Both portal to `document.body`, so when the dialog opens it renders **behind** the panel's backdrop:

- The panel's `bg-black/30` (z-55) intercepts clicks → dialog appears unresponsive.
- The dialog content sits below the panel → invisible.
- Radix still locks `body` scroll → page becomes unscrollable.
- `unitLeaders` toast only fires after a unit is picked, which the user can't do → "no toast displayed".

The Home Cell button "kind of worked" earlier only because its toasts (`No home cell centres`, etc.) fire on `useEffect` mount via Sonner's own higher-z portal — not because the dialog was actually visible.

## Fix

**`src/components/followups/SignPostDialog.jsx`** — render the dialog above the panel by using a manual portal + overlay + content with explicit high z-index, instead of the wrapped `DialogContent`:

```jsx
import { Dialog, DialogPortal, DialogOverlay, DialogDescription } from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";

<Dialog open={open} onOpenChange={handleOpenChange}>
  <DialogPortal>
    <DialogOverlay className="z-[65] bg-black/60" />
    <DialogPrimitive.Content
      className="fixed left-[50%] top-[50%] z-[70] grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg max-h-[90vh] overflow-y-auto sm:rounded-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
    >
      {/* TenantDialogHeader, DialogDescription, DialogErrorBoundary, body unchanged */}
      <DialogPrimitive.Close className="absolute right-4 top-4 ...">
        <X className="h-4 w-4" />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
</Dialog>
```

Net effect: overlay at z-65 sits above the panel backdrop (z-55), content at z-70 sits above everything → clicks land on the dialog, content is visible, toasts work.

No DB changes. No changes to `FollowupDetailPanel.jsx`. ~10 line change to swap `DialogContent` for the explicit portal+overlay+content trio.

After approval, please click **Refer to Unit Leader** again — the dialog should now appear in front of the slide-over and accept clicks. Share any `[SignPost]` console output if it still misbehaves.
