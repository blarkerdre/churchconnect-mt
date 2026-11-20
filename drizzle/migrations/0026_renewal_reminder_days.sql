ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS renewal_reminder_days integer NOT NULL DEFAULT 7 CHECK (renewal_reminder_days BETWEEN 0 AND 90);

CREATE OR REPLACE FUNCTION public.send_renewal_reminders()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n int := 0; days int;
BEGIN
  FOR r IN
    SELECT s.tenant_id, s.next_due_date::date AS due, s.amount, s.currency, s.payment_mode, t.renewal_reminder_days AS rd
    FROM tenant_subscriptions s JOIN tenants t ON t.id = s.tenant_id
    WHERE s.is_active AND s.next_due_date IS NOT NULL AND t.renewal_reminder_days > 0
      AND s.next_due_date::date - current_date <= t.renewal_reminder_days
  LOOP
    IF EXISTS (SELECT 1 FROM notifications WHERE tenant_id = r.tenant_id AND type = 'subscription_renewal' AND reference_id = r.due::text) THEN CONTINUE; END IF;
    days := r.due - current_date;
    INSERT INTO notifications (user_id, tenant_id, title, message, type, reference_id, reference_type)
    SELECT m.user_id, r.tenant_id, 'Subscription renewal',
      CASE WHEN days < 0 THEN 'Your subscription payment is overdue by ' || (-days) || ' day(s). Pay in Settings → Billing.'
           WHEN days = 0 THEN 'Your subscription payment is due today. Pay in Settings → Billing.'
           ELSE 'Your subscription renews in ' || days || ' day(s) on ' || to_char(r.due, 'DD Mon YYYY') || '. Pay in Settings → Billing.' END,
      'subscription_renewal', r.due::text, 'billing'
    FROM tenant_memberships m WHERE m.tenant_id = r.tenant_id AND m.role IN ('owner','admin');
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;
REVOKE EXECUTE ON FUNCTION public.send_renewal_reminders() FROM PUBLIC, anon, authenticated;