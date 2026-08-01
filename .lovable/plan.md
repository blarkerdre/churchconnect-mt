## Goal

Add the WOFBI Feedback Form to Bible School: admins can edit its questions (like the existing Application Form editor), and students are prompted to complete it once they've finished their course exams. Admins can view and export responses.

## The form (from your PDF, used as the default template)

- Your details (optional): Date, First name, Surname, Telephone, Email — auto-filled from the student's profile
- Satisfaction rating grid (Very satisfied → Very dissatisfied) for: Spiritual Impartation, Practical Application, Course Content, General Atmosphere
- "Is there any way we can improve your experience?" (long text)
- "Would you return for the next level (BCC/LCC)?" Yes/No
- "Would you recommend WOFBI to friends and family?" Yes/No
- "What did you like best?" (text)
- "Your Testimony" (long text)
- "I'd like to be on the mailing list for future events" Yes/No
- Confidentiality note shown at the foot of the form

## What gets built

**1. Admin editor — Bible School → new "Feedback Form" tab**
Mirrors the existing Application Form editor: enable/disable toggle, title, intro text, add/edit/reorder/delete fields, preview, and "Reset to default" which restores the fields above. Adds a new `rating_grid` field type (rows + scale columns) so the satisfaction table is editable — you can add or rename rows and change the scale labels.

**2. Student side**
Once a student has completed the exams for a course (all their subject attempts submitted), a "Course feedback" prompt appears on their Bible School view with a Complete feedback button. The form renders from the admin-configured schema, pre-fills their name/email/phone/date, and can be submitted once per course registration (re-openable in read-only after submission). Nothing appears if the form is disabled.

**3. Admin responses view**
A Responses sub-section inside the Feedback Form tab: list of submissions with student name, course, date; click to view full answers; CSV export; simple summary of the satisfaction grid averages and Yes/No counts.

## Technical notes

- New tables: `wofbi_feedback_forms` (tenant-scoped config, one per tenant, same shape as `wofbi_application_forms`: enabled/title/intro_text/fields JSONB) and `wofbi_feedback_responses` (tenant_id, course_id, registration_id, member_id, answers JSONB, submitted_at) with GRANTs + RLS: students insert/read their own; admins and Bible School managers read all for their tenant; unique on (registration_id).
- Reuse and extend `WoFBIDynamicForm.jsx` with the `rating_grid` type so both the editor preview and the student form share one renderer.
- Defaults live in a new `src/lib/wofbi-feedback-defaults.js`, alongside the existing `wofbi-form-defaults.js`.
- Gated by the existing `exam-management` module toggle; no changes to exam grading or the application form flow.
