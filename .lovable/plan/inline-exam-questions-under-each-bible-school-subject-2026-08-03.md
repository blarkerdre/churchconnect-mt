# Inline exam questions under each Bible School subject

Move the "Questions" area out of the block below the subject list and into an expanding panel inside the clicked subject row.

## Behaviour

- Clicking a subject row expands it accordion-style. The expanded area shows, for that subject only:
  - the question list (same cards as today: text, type badge, options with correct answer highlighted, points, edit/delete)
  - "Add Question" button
  - "Preview Exam" button (only when the subject has questions)
- Clicking the same row again collapses it; opening another subject collapses the previous one.
- Each subject row also gets compact icon buttons for quick access: a plus icon (add question) and an eye icon (preview exam), alongside the existing edit/delete icons. Using either icon also expands that subject.
- Row shows a question count badge so admins can see at a glance which subjects have questions.
- The old standalone "Questions — [subject]" section below the subject list is removed.

## Technical notes

- `src/components/exams/SubjectManager.jsx`: render an expandable region per subject row (chevron indicator), accept new props `renderSubjectPanel(subject)`, `onAddQuestion(subject)`, `onPreviewSubject(subject)`, and a `questionCounts` map. Keep the existing edit/delete row actions and `e.stopPropagation()` pattern for the new icons.
- `src/pages/ExamManagement.jsx`: move the questions list JSX into a small local component (`SubjectQuestionsPanel`) passed to `SubjectManager` via `renderSubjectPanel`; keep the existing question query, `openNew`/`openEdit`, delete dialog, and `previewSubject` TakeExamDialog state where they are. Delete the standalone questions section and its header buttons.
- Question counts: one grouped query over `exam_questions` for the selected course's subjects (tenant-scoped), used for the row badge and to decide whether the preview icon is enabled.
- All queries stay tenant-scoped with explicit `.eq("tenant_id", tenantId)`.
- Mobile (384px): icon buttons stay in the row with wrapping, panel content scrolls within the page.
