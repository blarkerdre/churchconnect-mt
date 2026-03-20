

## Delete Orphaned Auth Account and Prevent Future Orphans

### Part 1: Immediate Fix — Delete blarkerdre@yahoo.com auth account
Call the `admin-delete-user` edge function with user_id `26f0fa5e-7d98-496f-8d6f-61125963cccd` to remove the orphaned auth account.

### Part 2: Code Fix — Members page delete also removes auth account
When an admin deletes a member from the Members page, if that member has a linked `user_id`, also call the `admin-delete-user` edge function to remove the authentication account.

### Changes

**`src/pages/Members.jsx`** — Update `deleteMutation` and `handleDelete`:
- In `deleteMutation.mutationFn`: after deleting the member record, if the member had a `user_id`, invoke the `admin-delete-user` edge function to delete the auth account
- Update the confirm dialog text to warn that the linked login account will also be deleted (when applicable)
- Pass the full member object to the mutation instead of just the id

### Technical Detail
```text
Current flow:
  Members page delete → removes members row only
  Auth account remains → user can still sign in

New flow:
  Members page delete → removes members row
                      → if member.user_id exists, call admin-delete-user edge function
                      → auth account + profile + roles all cleaned up
```

