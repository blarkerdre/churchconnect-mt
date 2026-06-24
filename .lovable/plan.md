## Plan: resolve high & critical dependency advisories

### Findings → action

| Package | Current | Action | Why |
|---|---|---|---|
| `react-quill` | 2.0.0 | **Remove** | Not imported anywhere in `src/`. Already forbidden by project memory (XSS). Removes the lodash transitive too. |
| `jspdf` | ^4.0.0 (4.2.0) | **Bump to ^4.2.1** | 4.2.1 patches both advisories (HTML injection in new-window paths, PDF object injection via FreeText color). |
| `@supabase/supabase-js` | ^2.99.1 (2.104.1) | **Bump to ^2.108.2** | Pulls in patched `ws` (memory exhaustion). |
| `recharts` | ^2.15.4 | **Keep at 2.x** | The lodash advisory only affects `_.template`; recharts does not use it. Recharts 3.x is a breaking major and would require touching every chart. Will mark this specific finding as a false-positive (ignore) noting the unused code path. |
| `lodash` (direct dep) | ^4.17.21 | **Remove** | Not directly imported in `src/`. It's only there as a leftover from react-quill. |

### Steps

1. `bun remove react-quill lodash`
2. `bun add jspdf@^4.2.1 @supabase/supabase-js@^2.108.2`
3. Verify no remaining imports of `react-quill` or `lodash` (already confirmed).
4. Let the build run; confirm preview still renders and invoice PDF code path compiles.
5. Mark findings:
   - `vulnerable_dependencies_critical` → **fixed** (jspdf bumped).
   - `vulnerable_dependencies_high` → **fixed** (supabase-js + jspdf bumped, react-quill + lodash removed). The remaining recharts→lodash transitive will be addressed by an ignore note in security memory: recharts does not call `_.template`, so the advisory is not exploitable here.
6. Update `@security-memory` with the recharts/lodash rationale and the react-quill removal (consistent with existing memory).

### Out of scope

No application logic, UI, or schema changes. Pure dependency hygiene.
