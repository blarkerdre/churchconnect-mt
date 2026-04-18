
## Goal
Make leader/centre availability obvious in the Sign-Post dialog:
- Unit Leader path → show the **list of unit leaders** for the chosen unit (already there) **plus a clear toast** if none exist.
- Home Cell path → show the **auto-suggested centre AND its leader's name** inline, **plus a toast** if no centre matches or the centre has no linked leader.

## Plan

### 1. `SignPostDialog.jsx` — fetch and display leader info for selected centre
Add a small query (enabled only when a centre is selected) that resolves `centre.leader_id` (which is a `members.id`) → `members` row → `profiles.full_name`/`email`:
```js
const { data: centreLeader } = useQuery({
  queryKey: ["centre-leader", selectedCentre?.leader_id, tenantId],
  enabled: !!selectedCentre?.leader_id,
  queryFn: async () => {
    const { data: m } = await supabase.from("members")
      .select("user_id, first_name, last_name")
      .eq("id", selectedCentre.leader_id).maybeSingle();
    if (!m?.user_id) return { name: `${m?.first_name ?? ""} ${m?.last_name ?? ""}`.trim() || null, linked: false };
    const { data: p } = await supabase.from("profiles")
      .select("full_name, email").eq("user_id", m.user_id).maybeSingle();
    return { name: p?.full_name || p?.email || `${m.first_name} ${m.last_name}`, linked: true };
  },
});
```
Render under the centre details:
```
👤 Leader: Pastor Jane Doe
```
Or a muted "No leader linked to this centre" warning if missing.

### 2. Toasts (visible feedback)
Trigger informational toasts via `useEffect` when relevant queries resolve:
- **Unit leader path**: when `unitName` is set, query finishes, and `unitLeaders.length === 0` → `toast({ title: "No leaders assigned", description: "This unit has no leaders yet. Ask an admin to assign one.", variant: "destructive" })`.
- **Home Cell path**: when `centres` finishes loading and `centres.length === 0` → toast "No home cell centres found".
- **Auto-suggest**: if centres exist but `suggestedCentre` is `null` → toast "No closest centre match found — please pick one manually" (info, not destructive).
- **Centre leader missing**: when `selectedCentre` set but `centreLeader?.linked === false` → toast "Centre has no linked leader account".

Each effect uses a ref guard so toasts fire once per change (not on every render).

### 3. Inline UI improvements
- Show a small header above the unit-leaders Select: `Unit Leaders ({unitLeaders.length})`.
- For the home-cell suggested centre, render a compact card:
  ```
  ✨ Suggested: [Centre name]
  📍 [address, postcode]
  👤 [Leader name]   (or "Not linked" warning)
  ```

### Files Changed
- `src/components/followups/SignPostDialog.jsx` — add `centreLeader` query, leader display, and 3-4 effect-driven toasts (~50 lines)

No DB changes. No changes to `FollowupDetailPanel.jsx`.
