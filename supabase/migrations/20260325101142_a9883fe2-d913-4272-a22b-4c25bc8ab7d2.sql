CREATE POLICY "Anon can view tenant by slug"
ON public.tenants
FOR SELECT
TO anon
USING (true);