-- Allow authenticated users to insert their own member record (self-registration)
CREATE POLICY "Users can create own member record"
ON public.members
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);