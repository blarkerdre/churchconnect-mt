
-- =============================================================
-- WINNERS CHAPEL INTERNATIONAL CARDIFF - CHURCH MANAGEMENT SUITE
-- GDPR Compliant Schema (UK Data Residency)
-- =============================================================

-- ==================== ENUMS ====================
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'unit_leader', 'member');
CREATE TYPE public.membership_status AS ENUM ('Active', 'Inactive', 'New Convert', 'First Timer');
CREATE TYPE public.gender_type AS ENUM ('Male', 'Female');
CREATE TYPE public.followup_status AS ENUM ('Pending', 'In Progress', 'Completed', 'Overdue');
CREATE TYPE public.followup_type AS ENUM ('First Timer', 'New Convert', 'Absentee', 'General', 'Pastoral');
CREATE TYPE public.pastoral_care_status AS ENUM ('Open', 'In Progress', 'Resolved', 'Closed');
CREATE TYPE public.pastoral_care_type AS ENUM ('Counselling', 'Visitation', 'Prayer Request', 'Hospital Visit', 'Bereavement', 'Marriage', 'Financial Support', 'Other');
CREATE TYPE public.transport_status AS ENUM ('Pending', 'Confirmed', 'Completed', 'Cancelled');
CREATE TYPE public.session_type AS ENUM ('Sunday Service', 'Midweek Service', 'Special Program', 'Unit Meeting', 'WSF Meeting', 'Other');

-- ==================== UTILITY FUNCTION ====================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ==================== PROFILES TABLE ====================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==================== USER ROLES TABLE ====================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'member',
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Check if user is admin or super_admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'super_admin')
  )
$$;

-- ==================== MEMBERS TABLE ====================
CREATE TABLE public.members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  gender gender_type,
  date_of_birth DATE,
  address TEXT,
  city TEXT DEFAULT 'Cardiff',
  postcode TEXT,
  membership_status membership_status NOT NULL DEFAULT 'First Timer',
  membership_date DATE,
  church_unit TEXT,
  photo_url TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  water_baptism BOOLEAN DEFAULT false,
  holy_spirit_baptism BOOLEAN DEFAULT false,
  bfc_completed BOOLEAN DEFAULT false,
  bcc_completed BOOLEAN DEFAULT false,
  lcc_completed BOOLEAN DEFAULT false,
  ldc_completed BOOLEAN DEFAULT false,
  winners_satellite BOOLEAN DEFAULT false,
  workers_in_training BOOLEAN DEFAULT false,
  wsf_centre_id UUID,
  notes TEXT,
  gdpr_consent BOOLEAN DEFAULT false,
  gdpr_consent_date TIMESTAMPTZ,
  data_retention_reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_members_user_id ON public.members(user_id);
CREATE INDEX idx_members_status ON public.members(membership_status);
CREATE INDEX idx_members_name ON public.members(last_name, first_name);

CREATE TRIGGER update_members_updated_at
  BEFORE UPDATE ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==================== EVENTS TABLE ====================
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  location TEXT,
  category TEXT,
  capacity INTEGER,
  is_public BOOLEAN DEFAULT true,
  requires_registration BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==================== EVENT REGISTRATIONS ====================
CREATE TABLE public.event_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  guest_name TEXT,
  guest_email TEXT,
  status TEXT DEFAULT 'registered',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;

-- ==================== ATTENDANCE SESSIONS ====================
CREATE TABLE public.attendance_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_type session_type NOT NULL,
  session_date DATE NOT NULL,
  title TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_attendance_sessions_updated_at
  BEFORE UPDATE ON public.attendance_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==================== ATTENDANCE RECORDS ====================
CREATE TABLE public.attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  checked_in_at TIMESTAMPTZ DEFAULT now(),
  check_in_method TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, member_id)
);
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

-- ==================== FOLLOWUPS ====================
CREATE TABLE public.followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  followup_type followup_type NOT NULL,
  status followup_status NOT NULL DEFAULT 'Pending',
  assigned_to UUID REFERENCES auth.users(id),
  description TEXT,
  notes TEXT,
  due_date DATE,
  completed_date DATE,
  priority TEXT DEFAULT 'Medium',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.followups ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_followups_status ON public.followups(status);
CREATE INDEX idx_followups_assigned ON public.followups(assigned_to);

CREATE TRIGGER update_followups_updated_at
  BEFORE UPDATE ON public.followups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==================== PASTORAL CARE ====================
CREATE TABLE public.pastoral_care (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  care_type pastoral_care_type NOT NULL,
  status pastoral_care_status NOT NULL DEFAULT 'Open',
  subject TEXT NOT NULL,
  description TEXT,
  confidential BOOLEAN DEFAULT true,
  assigned_to UUID REFERENCES auth.users(id),
  resolution_notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pastoral_care ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_pastoral_care_updated_at
  BEFORE UPDATE ON public.pastoral_care
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==================== WSF CENTRES ====================
CREATE TABLE public.wsf_centres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT,
  leader_id UUID REFERENCES public.members(id),
  meeting_day TEXT,
  meeting_time TIME,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.wsf_centres ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_wsf_centres_updated_at
  BEFORE UPDATE ON public.wsf_centres
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Link members to WSF centres
ALTER TABLE public.members
  ADD CONSTRAINT fk_members_wsf_centre
  FOREIGN KEY (wsf_centre_id) REFERENCES public.wsf_centres(id) ON DELETE SET NULL;

-- ==================== WSF ATTENDANCE ====================
CREATE TABLE public.wsf_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id UUID NOT NULL REFERENCES public.wsf_centres(id) ON DELETE CASCADE,
  meeting_date DATE NOT NULL,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  present BOOLEAN DEFAULT true,
  notes TEXT,
  recorded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(centre_id, meeting_date, member_id)
);
ALTER TABLE public.wsf_attendance ENABLE ROW LEVEL SECURITY;

-- ==================== FIRST TIMERS ====================
CREATE TABLE public.first_timers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  how_heard TEXT,
  prayer_request TEXT,
  follow_up_assigned_to UUID REFERENCES auth.users(id),
  follow_up_status followup_status DEFAULT 'Pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.first_timers ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_first_timers_updated_at
  BEFORE UPDATE ON public.first_timers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==================== ANNOUNCEMENTS ====================
CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  is_published BOOLEAN DEFAULT false,
  publish_date TIMESTAMPTZ,
  expiry_date TIMESTAMPTZ,
  target_audience TEXT DEFAULT 'All',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==================== TRANSPORTATION ====================
CREATE TABLE public.transportation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id),
  pickup_address TEXT NOT NULL,
  destination TEXT DEFAULT 'Church',
  request_date DATE NOT NULL,
  pickup_time TIME,
  passengers INTEGER DEFAULT 1,
  status transport_status NOT NULL DEFAULT 'Pending',
  assigned_driver TEXT,
  driver_phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.transportation ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_transportation_updated_at
  BEFORE UPDATE ON public.transportation
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==================== MESSAGES ====================
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  recipient_id UUID REFERENCES auth.users(id),
  subject TEXT,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- ==================== APP SETTINGS ====================
CREATE TABLE public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- RLS POLICIES
-- =============================================================

-- PROFILES
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- USER ROLES
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- MEMBERS
CREATE POLICY "Authenticated users can view members" ON public.members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert members" ON public.members FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'unit_leader'));
CREATE POLICY "Admins can update members" ON public.members FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'unit_leader') OR auth.uid() = user_id);
CREATE POLICY "Admins can delete members" ON public.members FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- EVENTS
CREATE POLICY "Anyone can view public events" ON public.events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage events" ON public.events FOR ALL TO authenticated USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'unit_leader'));

-- EVENT REGISTRATIONS
CREATE POLICY "Users can view registrations" ON public.event_registrations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can register for events" ON public.event_registrations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "Admins can manage registrations" ON public.event_registrations FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- ATTENDANCE SESSIONS
CREATE POLICY "Authenticated can view sessions" ON public.attendance_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins/leaders can manage sessions" ON public.attendance_sessions FOR ALL TO authenticated USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'unit_leader'));

-- ATTENDANCE RECORDS
CREATE POLICY "Authenticated can view records" ON public.attendance_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins/leaders can manage records" ON public.attendance_records FOR ALL TO authenticated USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'unit_leader'));

-- FOLLOWUPS
CREATE POLICY "Admins/leaders can view followups" ON public.followups FOR SELECT TO authenticated USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'unit_leader') OR auth.uid() = assigned_to);
CREATE POLICY "Admins/leaders can manage followups" ON public.followups FOR ALL TO authenticated USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'unit_leader'));

-- PASTORAL CARE
CREATE POLICY "Authorized can view pastoral care" ON public.pastoral_care FOR SELECT TO authenticated USING (public.is_admin(auth.uid()) OR auth.uid() = assigned_to OR auth.uid() = created_by);
CREATE POLICY "Admins can manage pastoral care" ON public.pastoral_care FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- WSF CENTRES
CREATE POLICY "Authenticated can view centres" ON public.wsf_centres FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage centres" ON public.wsf_centres FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- WSF ATTENDANCE
CREATE POLICY "Authenticated can view wsf attendance" ON public.wsf_attendance FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins/leaders can manage wsf attendance" ON public.wsf_attendance FOR ALL TO authenticated USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'unit_leader'));

-- FIRST TIMERS
CREATE POLICY "Admins/leaders can view first timers" ON public.first_timers FOR SELECT TO authenticated USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'unit_leader'));
CREATE POLICY "Admins/leaders can manage first timers" ON public.first_timers FOR ALL TO authenticated USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'unit_leader'));

-- ANNOUNCEMENTS
CREATE POLICY "Authenticated can view published announcements" ON public.announcements FOR SELECT TO authenticated USING (is_published = true OR public.is_admin(auth.uid()));
CREATE POLICY "Admins can manage announcements" ON public.announcements FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- TRANSPORTATION
CREATE POLICY "Users can view own transport" ON public.transportation FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "Users can request transport" ON public.transportation FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage transport" ON public.transportation FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- MESSAGES
CREATE POLICY "Users can view own messages" ON public.messages FOR SELECT TO authenticated USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
CREATE POLICY "Users can send messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);

-- APP SETTINGS
CREATE POLICY "Authenticated can view settings" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage settings" ON public.app_settings FOR ALL TO authenticated USING (public.is_admin(auth.uid()));
