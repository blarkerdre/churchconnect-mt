

## Fix: Exam Questions Not Visible After Adding

### Problem

When adding questions to a subject, they are inserted **without `tenant_id`** (line 189-203 in `ExamManagement.jsx`). The `withTenant()` helper is available but not used on the insert payload. The SELECT query uses `scopeQuery()` which filters by `tenant_id`, so questions with `NULL` tenant_id never appear.

### Fix

**`src/pages/ExamManagement.jsx`** — wrap the insert payload with `withTenant()`:

Line 144: Change from:
```js
const { error } = await supabase.from("exam_questions").insert(payload);
```
to:
```js
const { error } = await supabase.from("exam_questions").insert(withTenant(payload));
```

This ensures every new question gets the current `tenant_id`, matching the SELECT filter.

### Bonus: Fix existing NULL-tenant questions

Run a data update to backfill any questions that were inserted without a tenant_id, by inheriting it from their linked subject:

```sql
UPDATE exam_questions eq
SET tenant_id = es.tenant_id
FROM exam_subjects es
WHERE eq.subject_id = es.id
  AND eq.tenant_id IS NULL
  AND es.tenant_id IS NOT NULL;
```

### Files changed

- **`src/pages/ExamManagement.jsx`** — add `withTenant()` to insert call
- **One data backfill** — fix existing orphaned questions

