## Why the source label flipped

In the Bible School registrations table (`ExamManagement.jsx`), the "Source" column is **not** stored on the registration. It's computed on the fly from the member record:

```js
r.members?.user_id ? "Member" : "QR / Public"
```

- If the linked `members` row has NO `user_id` → shown as **QR / Public**
- If the linked `members` row HAS a `user_id` → shown as **Member**

So the registration itself never changed. What changed is the underlying `members.user_id`:

1. Someone submits the public Bible School form via the QR link → a `members` row is created/matched with `user_id = null` → row shows **QR / Public**.
2. Later, when an admin approves and clicks "Send Exam Link", the `provision-exam-account` Edge Function creates an auth user for that email and links it back to the member (`members.user_id` gets set).
3. On the next reload the same registration is now classified as **Member**, because the derivation is live, not historical.

The same flip happens if the applicant later signs up / accepts an invite with the same email — the member gets a `user_id` and every past registration for that member re-labels itself.

This is a display artifact, not data loss. But it makes reporting on "how did they originally register" unreliable, and it explains the surprise.

## Proposed fix

Capture the true origin at write time and use it for display/filtering, instead of inferring from a mutable field.

### Steps

1. **Schema** — add an immutable origin column to `course_registrations`:
   ```
   registration_origin text  -- 'public_qr' | 'member_self' | 'admin' | 'import'
   ```
   Default `'admin'` for legacy rows. Backfill:
   - rows created by `public-wofbi-register` with no auth header → `'public_qr'`
   - rows created by `public-wofbi-register` with an authed user → `'member_self'`
   - everything else → `'admin'`
   (We can only backfill accurately going forward; historical rows use `members.user_id` as best-effort seed.)

2. **Write path** — `public-wofbi-register` sets `registration_origin` based on whether the request carried a valid Authorization header. `ExamManagement`'s admin add-member flow sets `'admin'`.

3. **Read path** — `ExamManagement.jsx` derives the Source badge/CSV/filter from `r.registration_origin` instead of `r.members?.user_id`. Filter options become: All / Public (QR) / Member self-service / Admin.

4. **Keep old signal too** — still show a small secondary badge "Has account" when `members.user_id` is set, so admins can see who has logged in without conflating it with origin.

### Out of scope

- No changes to email delivery, provisioning, or grading.
- No change to `wofbi_applications.source` (form vs direct) — that one is already stable.

### Technical notes

- File touched: `src/pages/ExamManagement.jsx` (source derivation at ~L1090, L1111, L1155, L1313; CSV at L1106).
- Edge function touched: `supabase/functions/public-wofbi-register/index.ts` — insert `registration_origin`.
- Migration: `ALTER TABLE public.course_registrations ADD COLUMN registration_origin text; CREATE INDEX ...; UPDATE ... backfill; ` plus a comment. RLS unchanged (column inherits table policies). No new GRANTs needed.
