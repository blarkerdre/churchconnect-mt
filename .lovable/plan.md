## Plan: Registration Form Updates (Public QR + Admin MemberFormDialog + MyProfile)

### Summary

Apply seven changes across the public registration form, admin member form, member self-service profile, dashboard, analytics, and the backend edge function/database.

### 1. Database Migration

- Add `'Visitor'` to the `membership_status` enum
- Update `update_own_member_profile` RPC to accept `'Visitor'` in its valid status list

```sql
ALTER TYPE public.membership_status ADD VALUE IF NOT EXISTS 'Visitor';
```

Then re-create the RPC with `'Visitor'` added to the CASE WHEN check.

### 2. Edge Function Update

`**supabase/functions/public-register/index.ts**` (line 81):

- Add `"Visitor"` to `VALID_STATUSES`

### 3. File Changes

All three form files get the same pattern of changes:


| Change                                                   | `PublicRegistration.jsx`                  | `MemberFormDialog.jsx`      | `MyProfile.jsx`             |
| -------------------------------------------------------- | ----------------------------------------- | --------------------------- | --------------------------- |
| Add "Visitor" to STATUSES array                          | line 20                                   | line 22                     | line 21                     |
| Rename "Church Growth Indices" → "Spiritual Development" | line 227                                  | line 396                    | lines 321, 602              |
| Rename "Notes" → "Prayer Request"                        | line 263 label                            | line 570 label              | line 360 label              |
| Add "(Optional)" to emergency contact labels             | lines 265-266                             | lines 563-564               | lines 353-354, 627-628      |
| Conditional emergency contact (Public reg only)          | Show only when First Timer or New Convert | N/A (admin always sees it)  | N/A                         |
| BFC prompt for Visitor (Public reg only)                 | Show BFC switch when Visitor selected     | N/A                         | N/A                         |
| GDPR link to privacy policy PDF                          | GDPR section                              | GDPR section (line 576-584) | GDPR section (line 632-641) |


### 5. BFC Prompt for Visitor (PublicRegistration.jsx only)

When membership status is `"Visitor"`, show a single switch/prompt: "Have you completed Believers Foundation Class (BFC)?" — reusing the existing `bfc_completed` field.

### 6. GDPR Privacy Policy Link

Update the GDPR consent text in all three forms to include a clickable link:

```
...in accordance with UK GDPR. View our <a href="/https://winners-chapel.org.uk/wp-content/uploads/2024/11/WMA_PrivacyPolicy2024.pdf">Privacy Policy</a>.
```

Place the PDF file in `public/WMA_PrivacyPolicy2024.pdf` (user will need to provide the actual file; for now we reference it).

### 7. Dashboard/Analytics Label Updates


| File                             | Change                                              |
| -------------------------------- | --------------------------------------------------- |
| `GrowthIndices.jsx` line 71      | "Church Growth Indices" → "Spiritual Development"   |
| `Analytics.jsx` line 258         | "Church Growth Indices" → "Spiritual Development"   |
| `MemberDashboard.jsx` line 21-26 | Add `"Visitor"` status color                        |
| `MemberDashboard.jsx` line 119   | "My Growth Milestones" → "My Spiritual Development" |


### Technical Notes

- The enum change is one-way (values cannot be removed from Postgres enums)
- The admin `MemberFormDialog` keeps emergency contact always visible since admins need full access
- The `MyProfile.jsx` has two rendering paths (editing mode at line 319 and initial setup at line 600); both get updated
- No RLS policy changes needed