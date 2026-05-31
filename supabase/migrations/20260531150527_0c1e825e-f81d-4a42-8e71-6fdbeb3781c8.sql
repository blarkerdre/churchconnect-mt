
-- 1) Add reports_officer to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'reports_officer';
