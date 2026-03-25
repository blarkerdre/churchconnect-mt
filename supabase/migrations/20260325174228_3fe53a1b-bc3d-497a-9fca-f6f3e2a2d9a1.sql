CREATE OR REPLACE FUNCTION public.claim_own_member_profile()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  _user_id uuid := auth.uid();
  _email text := lower(nullif(auth.jwt() ->> 'email', ''));
  _member_id uuid;
  _match_count integer;
begin
  if _user_id is null then
    raise exception 'Not authenticated';
  end if;

  select id into _member_id
  from public.members
  where user_id = _user_id
  order by created_at desc
  limit 1;

  if _member_id is not null then
    return _member_id;
  end if;

  if _email is null then
    return null;
  end if;

  select count(*) into _match_count
  from public.members
  where lower(email) = _email
    and user_id is null;

  if _match_count > 1 then
    raise exception 'Multiple member records match this email. Please contact an administrator.';
  end if;

  if _match_count = 1 then
    select id into _member_id
    from public.members
    where lower(email) = _email
      and user_id is null
    limit 1;

    update public.members
    set user_id = _user_id,
        updated_at = now()
    where id = _member_id
      and user_id is null;

    return _member_id;
  end if;

  return null;
end;
$function$;