## Goal
The dialog opens, members are selected, but clicking **Create Task** appears to do nothing — no toast, no dialog close, no row in `unit_tasks`. We need to surface what's actually happening.

## Likely causes (ranked)
1. The submit promise is hanging (e.g. `tenantId` is `null` so RLS silently rejects but the await never returns an error in the expected shape).
2. `user` is `undefined` at the moment of click → `user.id` throws synchronously, swallowed by something upstream.
3. An exception in `logAudit` or `supabase.functions.invoke(...)` is happening *before* `toast.success` (unlikely, but worth ruling out).
4. RLS rejects but the error message doesn't match `/row-level security/i` so a generic message *should* toast — confirm Toaster is mounted on this route.

## Changes (only to `src/components/unitTasks/UnitTaskFormDialog.jsx`)

1. **Guard preconditions explicitly** at the top of `submit`:
   - If `!tenantId` → `toast.error("No tenant context — reload the page")` and return.
   - If `!user?.id` → `toast.error("Not signed in")` and return.

2. **Add diagnostic logs** around each await so we can see in the browser console exactly where it stalls:
   ```
   console.log("[unit-task] submit start", { tenantId, userId: user?.id, unit: form.unit_name, count: selected.size });
   console.log("[unit-task] inserting task", payload);
   console.log("[unit-task] task created", task);
   console.log("[unit-task] inserting assignments", rows.length);
   ```

3. **Surface every error path with a visible toast** — currently the outer catch shows `err.message`, but if `err` is a PostgrestError object without `message`, it shows nothing useful. Use `err?.message || err?.error_description || JSON.stringify(err)`.

4. **Move `logAudit` and the notify invoke inside a `try { } catch` so a failure there can't break the success flow** (already fire-and-forget for invoke, but `logAudit` is awaited-ish — wrap defensively).

5. **Confirm `<Toaster />` (Sonner) is mounted globally** — quick read of `src/App.jsx` to verify. If missing on this route, toasts would never appear, which would perfectly explain "silently does nothing".

## Verification
After the change, you reproduce the click and share the browser console output. The logs will pinpoint the failing step, and I'll apply the precise fix (RLS, schema, or client-side) in a follow-up.

## Out of scope
No DB / RLS / edge function changes in this step — diagnose first, fix second.
