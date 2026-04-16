
## Fix: Unit Leadership Not Showing in Welcome Banner

### Root Cause
The leader badges (`Leads: ...` and `Home Cell Leader: ...`) live inside the `{myMember && (...)}` block (lines 105–127 of `MemberDashboard.jsx`). If the signed-in leader has no linked `members` row in the current tenant, the entire badges row — including the leadership badges — never renders. Even when `myMember` does exist, on a 384px viewport the row already contains status + church_unit + WSF badges, so the leader badges often wrap below the visible area or get visually buried.

### Fix
**`src/components/dashboard/MemberDashboard.jsx`** (welcome banner, ~lines 105–127):

1. **Move the leader badges OUT of the `myMember &&` block** into their own dedicated row that renders whenever `leaderUnits.length > 0` or `leaderCentres.length > 0`, regardless of whether a member profile exists.
2. **Style them more prominently** so they stand out on mobile — use a slightly larger pill with a leader icon (e.g. `Shield` or `Crown` from lucide-react) and the bright accent background.
3. Keep the existing membership status / church unit / WSF badges inside the original `myMember &&` block as-is.

### Resulting Layout (mobile)
```
[Avatar] Welcome, John!
         WCI Cardiff   [Owner]
         [Active] [Choir] [WSF — Cardiff]      ← only if myMember
         🛡 Leads: Choir, Ushers                ← always if leaderUnits
         🏠 Home Cell Leader: Cardiff Centre    ← always if leaderCentres
```

### Files Changed
- `src/components/dashboard/MemberDashboard.jsx` — restructure badge rows (~10 lines)
