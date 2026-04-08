

## Rename "BFC & Training Report" to "Training Report"

### Changes

All user-facing text references to "BFC & Training Report" or "BFC" in headers/labels will be changed to "Training Report". Internal identifiers (routes, query keys, component names) remain unchanged.

#### `src/pages/TrainingReports.jsx`
- Line 126: Page heading `"BFC & Training Report"` → `"Training Report"`
- Line 127: Description `"Record attendance and outcomes for BFC and training sessions"` → `"Record attendance and outcomes for training sessions"`
- Line 135: CSV filename prefix `"bfc-training-report-"` → `"training-report-"`
- Line 139: Print title `"BFC & Training Report"` → `"Training Report"`

#### Navigation / sidebar references
- Search for any "BFC" references in `AppLayout.jsx` or route config and update labels accordingly.

### Files changed
- `src/pages/TrainingReports.jsx` — rename 4 strings
- Possibly `src/components/AppLayout.jsx` — update nav label if present

