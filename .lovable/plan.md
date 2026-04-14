

## Add "Share Publicly" Consent to Testimony Form

### What Changes
Add a checkbox to the testimony submission form letting members indicate whether they consent to having their testimony shared publicly (e.g. in church services or publications). This preference is stored in the database and included in the email notification to admins.

### Steps

1. **Database migration** — add a `share_publicly` boolean column (default `false`) to the `testimonies` table
2. **Frontend — `src/pages/Testimony.jsx`** — add a Checkbox + label below the last textarea: "I would like my testimony to be shared in church"
   - Add `share_publicly: false` to form state
   - Pass `share_publicly` in the edge function body
   - Show the value in the "My Testimonies" history cards
3. **Frontend — `src/components/testimony/TestimonyFormDialog.jsx`** — same checkbox addition for the dialog variant
4. **Edge function — `supabase/functions/send-testimony/index.ts`** — accept `share_publicly`, save it to DB, and include a line in the email ("Member has consented to sharing" or "Member prefers this testimony to remain private")

### Technical Details
- Column: `share_publicly boolean NOT NULL DEFAULT false`
- No RLS changes needed (existing policies cover the column)
- The checkbox uses the existing `@/components/ui/checkbox` component

