
ALTER POLICY "Admins view tenant call logs" ON public.call_log TO authenticated;
ALTER POLICY "Leaders view own initiated call logs" ON public.call_log TO authenticated;

ALTER POLICY "Workers update checkins" ON public.child_checkins TO authenticated;

ALTER POLICY "Guardian issues delegation" ON public.child_pickup_delegations TO authenticated;
ALTER POLICY "Read delegations for own children or workers" ON public.child_pickup_delegations TO authenticated;

ALTER POLICY "Leaders view all availability" ON public.driver_availability TO authenticated;

ALTER POLICY "Insert referrals: admins or followup team" ON public.followup_referrals TO authenticated;
ALTER POLICY "Update referrals: admins, referrer, assigned leader" ON public.followup_referrals TO authenticated;
ALTER POLICY "View referrals: admins, referrer, assigned leader, followup tea" ON public.followup_referrals TO authenticated;
ALTER POLICY "Insert referral updates: assigned leader or admins" ON public.followup_referral_updates TO authenticated;
ALTER POLICY "View referral updates: admins, referrer, assigned leader, follo" ON public.followup_referral_updates TO authenticated;

ALTER POLICY "Users delete own sermon folders" ON public.sermon_note_folders TO authenticated;
ALTER POLICY "Users insert own sermon folders" ON public.sermon_note_folders TO authenticated;
ALTER POLICY "Users update own sermon folders" ON public.sermon_note_folders TO authenticated;
ALTER POLICY "Users view own sermon folders" ON public.sermon_note_folders TO authenticated;

ALTER POLICY "utg_delete" ON public.unit_task_groups TO authenticated;
ALTER POLICY "utg_insert" ON public.unit_task_groups TO authenticated;
ALTER POLICY "utg_select" ON public.unit_task_groups TO authenticated;
ALTER POLICY "utg_update" ON public.unit_task_groups TO authenticated;

DROP POLICY IF EXISTS "Admins can manage wsf zones" ON public.wsf_zones;
