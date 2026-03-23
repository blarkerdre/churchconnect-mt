

## Rename "Attendance" → "Unit Attendance" and "Training Reports" → "BFC Report"

Simple label rename across the app. No logic or structural changes.

### Files to update

**1. `src/components/AppLayout.jsx`**
- Line 24: `"Attendance"` → `"Unit Attendance"`
- Line 30: `"Training Reports"` → `"BFC Report"`

**2. `src/pages/TrainingReports.jsx`**
- Update any visible heading/title text from "Training Reports" to "BFC Report"

**3. `src/pages/Settings.jsx`**
- Line ~402: description `"training reports"` → `"BFC reports"`

**4. `src/pages/Presentation.jsx`**
- Line 316: `"Training Reports"` → `"BFC Report"` in the feature showcase

**5. `src/App.jsx`**
- No route path changes needed (paths stay `/attendance` and `/training-reports`)

