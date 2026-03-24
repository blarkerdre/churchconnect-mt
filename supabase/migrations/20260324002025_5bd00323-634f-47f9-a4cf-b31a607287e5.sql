
-- Add reminder_hours_before to events
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS reminder_hours_before integer[];

-- Create books_of_the_month table
CREATE TABLE public.books_of_the_month (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  author text NOT NULL,
  description text,
  cover_image_url text,
  month date NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true
);

ALTER TABLE public.books_of_the_month ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage books" ON public.books_of_the_month
  FOR ALL TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Authenticated can view books" ON public.books_of_the_month
  FOR SELECT TO authenticated
  USING (true);

-- Create profile-photos storage bucket (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-photos', 'profile-photos', true)
ON CONFLICT (id) DO NOTHING;

-- RLS for profile-photos bucket
CREATE POLICY "Authenticated users can upload profile photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'profile-photos');

CREATE POLICY "Anyone can view profile photos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'profile-photos');

CREATE POLICY "Users can update own profile photos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'profile-photos')
WITH CHECK (bucket_id = 'profile-photos');

CREATE POLICY "Users can delete own profile photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'profile-photos');

-- Create book-covers storage bucket (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('book-covers', 'book-covers', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admins can upload book covers"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'book-covers' AND is_admin(auth.uid()));

CREATE POLICY "Anyone can view book covers"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'book-covers');

CREATE POLICY "Admins can update book covers"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'book-covers' AND is_admin(auth.uid()))
WITH CHECK (bucket_id = 'book-covers' AND is_admin(auth.uid()));

CREATE POLICY "Admins can delete book covers"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'book-covers' AND is_admin(auth.uid()));
