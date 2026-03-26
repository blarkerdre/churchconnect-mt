

## Plan: Remove "Cardiff" from Default Auth Page

### Change

In `src/pages/Auth.jsx`, line 39, change the default subtitle from `"International Cardiff"` to `"International"` (or remove it entirely).

**File:** `src/pages/Auth.jsx`
- Line 39: `const churchSubtitle = tenant ? null : "International Cardiff";` → `const churchSubtitle = tenant ? null : "International";`

