## Plan: address recurring recharts → lodash advisory

This is the same finding that re-surfaced. The advisory (GHSA-r5fr-rjxr-66jc) only affects `lodash.template`. Recharts does **not** call `_.template`, and we removed the direct `lodash` import last turn — so the runtime risk is zero. Two paths forward:

### Option A — Upgrade recharts to v3 (recommended, fully removes advisory)

- Recharts 3.x drops the `lodash` dependency entirely (uses `es-toolkit` instead), so the advisory disappears from `npm audit`.
- We use only stable primitives (`BarChart`, `LineChart`, `PieChart`, `XAxis`, `YAxis`, `Tooltip`, `Legend`, `CartesianGrid`, `ResponsiveContainer`, `Cell`, plus `RechartsPrimitive` re-export in `src/components/ui/chart.jsx`) across 6 files. These APIs are unchanged in v3; the main 3.x breaking changes are around `defaultProps`, removed legacy components, and stricter TS types — none of which apply to our JS usage.
- Steps:
  1. `bun add recharts@^3`
  2. Smoke-test the charts pages: `/analytics`, `/church-attendance`, `/certificates-report`, dashboards.
  3. If a chart breaks (unlikely given our basic usage), patch the call site.
  4. Mark `vulnerable_dependencies_high` fixed.

### Option B — Ignore the finding as non-exploitable

- Keep recharts 2.15.4. Mark the finding as `ignore` with the rationale already in `@security-memory`: lodash advisory is `_.template` only; recharts doesn't use it; no direct lodash import.
- Pros: zero churn. Cons: scanner may re-flag on future scans unless explicitly ignored (which is what we'd do here).

### Recommendation

Go with **Option A**. It's a single dependency bump with minimal risk for our usage, and it removes the noise permanently.
