## Root cause

The error `invalid input syntax for type time: ""` is thrown by the database trigger functions `notify_transport_leaders_on_new_booking` and `notify_transport_assignment` (in migration `20260330131834_...sql`, also re-applied in `20260331002402_...sql`).

Both build a JSON payload with:

```sql
'pickup_time', COALESCE(NEW.pickup_time, '')
```

`NEW.pickup_time` is `TIME`, so PostgreSQL tries to cast the `''` fallback to `TIME` and fails whenever a booking is inserted/updated without a pickup time. This blocks the transaction, so users see the error when creating or updating a booking with no time set.

## Fix

Add a new migration that re-creates both trigger functions with `pickup_time` cast to text before COALESCE:

```sql
'pickup_time', COALESCE(NEW.pickup_time::text, '')
```

No other logic changes. Triggers stay attached; we just `CREATE OR REPLACE FUNCTION` the two functions.

## Files

- New migration `supabase/migrations/<timestamp>_fix_transport_trigger_time_cast.sql` containing the two updated `CREATE OR REPLACE FUNCTION` definitions (identical to current, with `NEW.pickup_time::text` on the two COALESCE lines).

No frontend changes required — `bookMutation` already sends `null` for empty times, and `manageForm` doesn't touch `pickup_time`.