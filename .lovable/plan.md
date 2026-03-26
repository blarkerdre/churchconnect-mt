

## Issue: Live Environment Not Rendering

### Diagnosis

The **preview** environment is working correctly -- network requests show successful data loading, and the console has no crash errors. The **published/live** environment (`churchconnect-mt.lovable.app`) is still running an older build that contains the bugs we've since fixed (the conditional hook violation in Auth.jsx, the unhardened AppLayout tenant switch code).

### Root Cause

The live site hasn't been re-published since the recent fixes. The published build still has the old broken code.

### Fix

**Publish the project** to deploy the latest code to the live environment. No code changes are needed -- just a publish action.

### Secondary Issue: Missing Profile Row

The network requests show a recurring 406 error on the `profiles` table query. The user (`6483c76f-...`) has no row in the `profiles` table, causing `.single()` to fail. While this is handled gracefully (the app continues), it should be fixed by either:

1. Inserting a profile row for this user via the database
2. Changing `.single()` to `.maybeSingle()` in `useAuth.jsx` line 55 to prevent the 406 error entirely

I recommend doing **both**: change to `.maybeSingle()` for resilience, then publish.

### Steps

1. Change `useAuth.jsx` line 55: `.single()` → `.maybeSingle()` to handle missing profiles gracefully
2. Publish the project to deploy all recent fixes to the live environment

