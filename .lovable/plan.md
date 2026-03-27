

## Fix: Redeploy `public-register` Edge Function

### Problem

The `public-register` edge function is returning a non-2xx status when a user signs up from `/t/wci-cardiff/auth` and tries to create their profile. The edge function logs show only "booted" messages with **no request-level logs at all** — no "Registration error", no "Welcome email triggered", nothing. This indicates the currently deployed version of the function does not include the recent `tenant_slug` fallback fix.

### Root Cause

The code changes made in the previous round (adding `tenant_slug` resolution on lines 210-221) were saved to the file but the edge function was likely not redeployed. The live function is still running the old code that rejects requests without a `tenant_id`.

### Fix

**Redeploy the `public-register` edge function.** No code changes needed — the file already contains the correct logic.

### Files changed

None — deployment only.

