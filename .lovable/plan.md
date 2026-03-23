

## Plan: Course Registration System with Admin-Controlled Exam Access

### Summary
Transform the exam system so that: (1) members can access a dedicated Exams page to register for courses, (2) admins control when course registration is open/closed, (3) admins control when exams can be started (exam window), and (4) members can only take subject exams for courses they've registered for, when the admin has opened the exam window.

---

### 1. Database Changes

**New table: `course_registrations`**
Tracks which members have registered for which courses.

```sql
CREATE TABLE public.course_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL,
  course_id UUID NOT NULL REFERENCES public.exam_titles(id) ON DELETE CASCADE,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(member_id, course_id)
);

ALTER TABLE public.course_registrations ENABLE ROW LEVEL SECURITY;

-- Members can view own registrations
CREATE POLICY "Members can view own registrations" ON public.course_registrations
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM members m WHERE m.id = course_registrations.member_id AND m.user_id = auth.uid()));

-- Members can insert own registrations
CREATE POLICY "Members can register for courses" ON public.course_registrations
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM members m WHERE m.id = course_registrations.member_id AND m.user_id = auth.uid()));

-- Admins can manage all
CREATE POLICY "Admins can manage registrations" ON public.course_registrations
  FOR ALL TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));
```

**Add columns to `exam_titles`:**
```sql
ALTER TABLE public.exam_titles
  ADD COLUMN registration_open BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN exams_open BOOLEAN NOT NULL DEFAULT false;
```

- `registration_open` — when true, members can register for this course
- `exams_open` — when true, registered members can start subject exams

---

### 2. Admin Controls on ExamManagement Page

**`src/pages/ExamManagement.jsx`**
- Add two toggle switches per course in the course card/chip area or edit dialog:
  - "Registration Open" toggle → controls `registration_open`
  - "Exams Open" toggle → controls `exams_open`
- Show badges on course chips indicating status (e.g., "Reg Open", "Exams Open")
- Course edit dialog updated to include both toggles

---

### 3. Member-Facing Exams Page

**New page concept — repurpose route `/exam-management`**
- Change the route so members (not just admins) can access it
- The page shows different views based on role:
  - **Admin view**: Full current ExamManagement (courses, subjects, questions, results) + new registration/exam toggles
  - **Member view**: Shows available courses, registration buttons, and exam-taking UI

**Member view on the Exams page:**
- List all active courses
- For courses with `registration_open = true`: show "Register" button (if not already registered)
- For registered courses with `exams_open = true`: show subject exam buttons (same logic as current DynamicExamButtons)
- For registered courses with `exams_open = false`: show "Exams not yet available" message
- Show progress (completed subjects, scores) for registered courses

**`src/App.jsx` route change:**
- Change `/exam-management` from `AdminRoute` to `ProtectedRoute` (any authenticated user)

**`src/components/AppLayout.jsx` nav change:**
- Change "Exam Management" nav item access from `"admin"` to `null` (visible to all authenticated users)
- Rename to "Exams" for clarity

---

### 4. Update MyProfile DynamicExamButtons

**`src/pages/MyProfile.jsx`**
- Update `DynamicExamButtons` to only show courses the member is registered for
- Only show exam buttons when `exams_open = true` for that course
- Keep the existing retake logic

---

### Technical Details

**Files modified:**
- `src/pages/ExamManagement.jsx` — split into admin/member views, add registration & exam toggles
- `src/pages/MyProfile.jsx` — filter by registered courses and `exams_open` flag
- `src/App.jsx` — change route guard from AdminRoute to ProtectedRoute
- `src/components/AppLayout.jsx` — change nav access, rename to "Exams"

**New migration:**
- Create `course_registrations` table with RLS
- Add `registration_open` and `exams_open` columns to `exam_titles`

**Flow:**
```text
Admin creates course → toggles "Registration Open"
  → Members see course on Exams page → click "Register"
  → Admin toggles "Exams Open"
  → Registered members can now take subject exams
  → Admin closes registration/exams when done
```

