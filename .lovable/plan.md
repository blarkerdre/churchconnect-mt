

## Fix: Duplicate Member Registration + Delete Duplicate Record

### Problem
`dvpwallace@yahoo.com` (Daphne Wallace) was registered twice within 12 seconds via the public registration form. The `public-register` edge function has no duplicate check for unauthenticated submissions — it only checks by `user_id` (which is null for public registrations). Neither record has any linked data (no course registrations, attendance, exams, or followups).

### Solution

#### 1. Delete the duplicate member record
Use the insert tool to delete the second (newer) duplicate:
```sql
DELETE FROM members WHERE id = '701d1fe0-727a-417c-a03a-2580aaf0d231';
```
Keep the first record (`c7d807f5-0a62-49f9-a86d-242283c1432f`).

#### 2. Add duplicate email guard to `public-register` edge function
Before inserting a new member (for unauthenticated requests), check if a member with the same email already exists in the same tenant. If so, update the existing record instead of creating a new one.

Add this check around line 455 (before the INSERT), for the unauthenticated branch:
```typescript
// Check for existing member by email (prevents duplicates from double-submit)
if (email) {
  let dupeQuery = supabase.from("members").select("id").eq("email", email);
  if (tenantId) dupeQuery = dupeQuery.eq("tenant_id", tenantId);
  const { data: existingByEmail } = await dupeQuery.limit(1).maybeSingle();
  
  if (existingByEmail) {
    // Update existing record instead of creating duplicate
    await supabase.from("members").update(memberPayload).eq("id", existingByEmail.id);
    resultMemberId = existingByEmail.id;
    resultMode = "updated";
    if (email) triggerWelcomeEmail(email, firstName, lastName, tenantId);
    return new Response(JSON.stringify({ success: true, mode: resultMode }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}
```

#### 3. Add UI double-submit prevention
In `src/pages/PublicRegistration.jsx`, disable the submit button while the mutation is pending to prevent rapid double-clicks.

### Files changed
- **Database** — delete duplicate record (insert tool)
- `supabase/functions/public-register/index.ts` — add email duplicate check for unauthenticated registrations
- `src/pages/PublicRegistration.jsx` — disable submit button during pending state

