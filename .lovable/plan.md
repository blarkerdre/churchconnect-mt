## Clarify course aggregate pass mark label and add helper text

### Goal
Reduce admin confusion between per-subject pass marks and the overall course pass requirement by improving the label and adding explanatory helper text in the course edit dialog.

### Changes
1. **Label update** — Change `Aggregate Pass Mark (%)` to `Course Pass Mark (%)` in the course create/edit dialog (`src/pages/ExamManagement.jsx`).
2. **Helper text** — Add a short `<p className="text-[11px] text-muted-foreground mt-1">` explanation directly below the input:
   > "The minimum overall percentage a student needs across all subjects to pass the entire course and receive a certificate. This is separate from each subject's own pass mark."

### Why
Admins currently confuse the course-wide aggregate with per-subject pass marks because the label "Aggregate" is ambiguous and there is no inline explanation.

### Files touched
- `src/pages/ExamManagement.jsx` (course dialog form section)