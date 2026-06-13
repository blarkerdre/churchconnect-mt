## Diagnosis

Dominion’s check-in button is working at the UI level, but the backend check-in function fails before creating the PIN record.

The actual error is:

```text
function digest(text, unknown) does not exist
```

That means the `checkin_child` database function is trying to hash the generated PIN with `digest(...)`, but the required database crypto extension/function is not available in the function’s current context.

## Plan

1. **Enable the required crypto support**
   - Add a migration to ensure the backend crypto extension used for PIN hashing is available.

2. **Harden the check-in function**
   - Update `checkin_child` so the PIN hash call is explicit and stable.
   - Keep the existing protections:
     - only Children Church workers/admins can check in children
     - PIN must be 6 digits
     - a child cannot be checked in twice without pickup first
     - all data stays tenant-scoped

3. **Verify Dominion can check in**
   - Re-check the `checkin_child` function definition after migration.
   - Confirm Dominion has no open duplicate check-in blocking her.
   - The button should then generate the 6-digit pickup code instead of silently failing.