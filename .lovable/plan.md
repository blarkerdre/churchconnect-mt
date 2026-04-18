
The user wants the single "Refer to Leader" button split into two distinct buttons: one for Unit Leader and one for Home Cell Leader. Let me check the current implementation in `FollowupDetailPanel.jsx`.
<lov-tool-use id="toolu_vrtx_018VdgdBa7dY9H1qcXcbUSvs" name="code--search_files" integration-id="code" data="{\"query\": \"Refer to Leader\", \"include_patterns\": \"*.jsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01Ezy9PxbfAzYjRHUKsY9uLb" name="code--search_files" integration-id="code" data="{\"query\": \"SignPostDialog\", \"include_patterns\": \"*.jsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01BFQPYFVskfJZNPGb5CzoSU" name="code--search_files" integration-id="code" data="{\"include_patterns\": \"FollowupDetailPanel.jsx\", \"query\": \"signPostOpen|Sign-Post|setSignPostOpen\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01CLNaAXYJMfmfhZiNE7a3ud" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/followups/SignPostDialog.jsx\"}">
</lov-tool-use>
<lov-plan>
## Goal
Replace the single "Refer to Leader" button with **two distinct buttons** so the action is clearer:
- **Refer to Unit Leader** — opens the dialog pre-set to unit-leader mode
- **Refer to Home Cell Leader** — opens the dialog pre-set to home-cell mode

## Plan

### 1. `FollowupDetailPanel.jsx` (around line 330–345)
Replace the single "Refer to Leader" Button with two compact buttons (icons + label) side by side. Each click sets a new state `signPostType` ('unit_leader' | 'home_cell_leader') and opens the dialog:

```jsx
const [signPostType, setSignPostType] = useState("unit_leader");
// ...
<Button size="sm" variant="outline" onClick={() => { setSignPostType("unit_leader"); setSignPostOpen(true); }}>
  <Users /> Refer to Unit Leader
</Button>
<Button size="sm" variant="outline" onClick={() => { setSignPostType("home_cell_leader"); setSignPostOpen(true); }}>
  <Home /> Refer to Home Cell Leader
</Button>
```

Pass `defaultType={signPostType}` to `<SignPostDialog>`.

### 2. `SignPostDialog.jsx`
- Accept new prop `defaultType` (default `"unit_leader"`).
- Initialize `type` state from it: `useState(defaultType)`.
- Add a `useEffect` that resets `type` to `defaultType` whenever the dialog opens, so each button correctly drives mode.
- Keep the existing in-dialog toggle so users can still switch within the dialog if needed (or hide if user prefers — see assumption below).

### Layout (mobile 384px)
Stack the two buttons full-width on small screens (`flex-col sm:flex-row`) so labels don't truncate.

## Assumption
Keep the in-dialog Unit/Home Cell toggle intact as a fallback to switch within the dialog. If you'd rather hide it once a button has chosen a mode, say so and I'll remove it.

## Files Changed
- `src/components/followups/FollowupDetailPanel.jsx` — split button, add `signPostType` state (~10 lines)
- `src/components/followups/SignPostDialog.jsx` — accept and apply `defaultType` prop (~6 lines)

No DB changes.
