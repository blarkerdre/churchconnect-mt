

## Add Testimony Title + Sent Testimonies History

### Summary
Add a "title" field to the testimony form (below name), persist testimonies in a new database table, and show members their sent testimonies with search functionality.

### Database Migration
Create a `testimonies` table to store submitted testimonies:

```sql
CREATE TABLE public.testimonies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  member_name text,
  title text NOT NULL,
  situation text NOT NULL,
  action text NOT NULL,
  god_did text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.testimonies ENABLE ROW LEVEL SECURITY;

-- Members can view their own testimonies
CREATE POLICY "Members can view own testimonies"
  ON public.testimonies FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND user_has_tenant_access(tenant_id));

-- Admins can view all testimonies in tenant
CREATE POLICY "Admins can view all testimonies"
  ON public.testimonies FOR SELECT TO authenticated
  USING (is_admin(auth.uid(), tenant_id));

-- Service role can insert (edge function)
CREATE POLICY "Service role can insert testimonies"
  ON public.testimonies FOR INSERT TO public
  WITH CHECK (auth.role() = 'service_role');
```

### Edge Function Update: `send-testimony/index.ts`
- Accept new `title` field and `user_id`
- Insert testimony into `testimonies` table before sending email
- Include title in email subject and body

### UI Update: `src/pages/Testimony.jsx`
- Add "Testimony Title" input field between Name and Situation
- Add a "My Testimonies" section below the form with:
  - Search input filtering by title/situation/god_did
  - List of sent testimonies as expandable cards showing title, date, and content
- Fetch testimonies from the new table using `useQuery`
- Use Tabs to separate "New Testimony" and "My Testimonies"

### Files Changed
- **Migration**: New `testimonies` table with RLS
- **Edit**: `supabase/functions/send-testimony/index.ts` — accept title + user_id, insert into DB
- **Edit**: `src/pages/Testimony.jsx` — add title field, tabs, history list with search
- **Edit**: `src/components/testimony/TestimonyFormDialog.jsx` — add title field (keep in sync)

