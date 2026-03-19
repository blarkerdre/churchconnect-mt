
-- 1. Create a SECURITY DEFINER RPC for member self-updates (safe fields only)
CREATE OR REPLACE FUNCTION public.update_own_member_profile(
  _member_id uuid,
  _first_name text DEFAULT NULL,
  _last_name text DEFAULT NULL,
  _email text DEFAULT NULL,
  _phone text DEFAULT NULL,
  _address text DEFAULT NULL,
  _city text DEFAULT NULL,
  _postcode text DEFAULT NULL,
  _date_of_birth date DEFAULT NULL,
  _gender text DEFAULT NULL,
  _emergency_contact_name text DEFAULT NULL,
  _emergency_contact_phone text DEFAULT NULL,
  _notes text DEFAULT NULL,
  _photo_url text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify the member belongs to the calling user
  IF NOT EXISTS (
    SELECT 1 FROM public.members
    WHERE id = _member_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized to update this member profile';
  END IF;

  UPDATE public.members SET
    first_name = COALESCE(_first_name, first_name),
    last_name = COALESCE(_last_name, last_name),
    email = COALESCE(_email, email),
    phone = COALESCE(_phone, phone),
    address = COALESCE(_address, address),
    city = COALESCE(_city, city),
    postcode = COALESCE(_postcode, postcode),
    date_of_birth = COALESCE(_date_of_birth, date_of_birth),
    gender = CASE WHEN _gender IS NOT NULL AND _gender IN ('Male', 'Female') THEN _gender::gender_type ELSE gender END,
    emergency_contact_name = COALESCE(_emergency_contact_name, emergency_contact_name),
    emergency_contact_phone = COALESCE(_emergency_contact_phone, emergency_contact_phone),
    notes = COALESCE(_notes, notes),
    photo_url = COALESCE(_photo_url, photo_url),
    updated_at = now()
  WHERE id = _member_id AND user_id = auth.uid();
END;
$$;

-- 2. Drop the old broad UPDATE policy that includes auth.uid() = user_id
DROP POLICY IF EXISTS "Admins can update members" ON public.members;

-- 3. Recreate admin/leader UPDATE policy WITHOUT user_id check
CREATE POLICY "Admins and leaders can update members"
ON public.members
FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role))
WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role));
