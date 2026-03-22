
## Plan: Certificate Course → Subjects Hierarchy with Aggregate Scoring

### Status: ✅ IMPLEMENTED

### What was done:
1. **Database**: Added `pass_mark_percentage` to `exam_titles`, created `exam_subjects` table, added `subject_id` to `exam_questions` and `exam_attempts`
2. **ExamManagement.jsx**: Restructured to Course → Subject → Question hierarchy with CRUD at each level, plus Course Results View
3. **TakeExamDialog.jsx**: Accepts `subjectId`/`subjectName`, fetches questions by subject, checks course completion for certificate auto-issuance
4. **MyProfile.jsx**: Shows course cards with subject-level exam buttons, per-subject scores, aggregate progress, downloadable score report
5. **New components**: `SubjectManager.jsx`, `CourseResultsView.jsx`
