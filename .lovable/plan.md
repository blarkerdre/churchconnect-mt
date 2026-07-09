## Move lecturer rating/feedback into a new tab in Bible School Management

Split the admin view of `src/pages/ExamManagement.jsx` into two tabs using shadcn `Tabs`:

- **Management** (default) — existing content: WoFBI About editor, Certificate Courses, Subjects, Questions, etc. The `LecturerManager` card and the header "Rate a Lecturer" button move OUT of here.
- **Lecturer Feedback** — contains:
  - The "Rate a Lecturer" button (gated by `adminLecturerRatingEnabled && myMember?.id`) at the top right of the tab.
  - `<LecturerManager />` card (toggle + lecturers table + feedback dialog — unchanged internally).
  - The mounted `<RateLecturerDialog>` for the admin.

### Edits

`src/pages/ExamManagement.jsx` only:
1. Import `Tabs, TabsList, TabsTrigger, TabsContent` from `@/components/ui/tabs`.
2. Keep the page `<h1>` header and the Registration QR button outside the tabs.
3. Remove the "Rate a Lecturer" button and `LecturerManager` from their current inline positions.
4. Wrap the remaining admin sections in `<Tabs defaultValue="management">` with two `TabsTrigger`s.
5. Move the Rate button, `RateLecturerDialog`, and `LecturerManager` into the "Lecturer Feedback" `TabsContent`.

### Out of scope
- No database or RLS changes.
- No changes to `LecturerManager.jsx` or `RateLecturerDialog.jsx`.
- Member (non-admin) view unchanged.
