I found the issue: the new course session components exist, but they are only shown on **My Profile** and the admin session manager is not mounted anywhere on the **Bible School** page.

Plan:

1. **Add sessions to admin Bible School Management**
   - Import and render `ExamSessionManager` on `src/pages/ExamManagement.jsx`.
   - Place it near the top of the admin Bible School page, before the course/subject question management area, so admins can create, edit, start, stop, enrol, and view sessions from Bible School directly.

2. **Add open sessions to member Bible School**
   - Import and render `OpenSessionsPanel` inside the member Bible School view.
   - Place it above the existing course list so members can see active Certificate Course Sessions and register from the Bible School page, not only My Profile.

3. **Keep existing behaviour intact**
   - Do not change database logic or permissions.
   - Keep the existing per-course registration/exam cards underneath, so members can still take exams after registering.
   - Preserve tenant scoping and existing `memberId` usage.