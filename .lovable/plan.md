
## Goal
Restrict `exam_questions.correct_answer` reads to admins only — unit leaders should still be able to view/edit question text and options (so they can author and review questions), but should not be able to see the correct answer column directly.

## Approach
Splitting `correct_answer` into a separate admin-only table is the cleanest fix and matches the scanner's recommendation. Keeps the existing UX (unit leaders still author questions) while removing answer-leak risk.

### Migration
1. **New table** `public.exam_question_answers` (admin-only):
   ```sql
   CREATE TABLE public.exam_question_answers (
     question_id uuid PRIMARY KEY REFERENCES public.exam_questions(id) ON DELETE CASCADE,
     correct_answer text NOT NULL,
     tenant_id uuid NOT NULL,
     updated_at timestamptz NOT NULL DEFAULT now()
   );
   ALTER TABLE public.exam_question_answers ENABLE ROW LEVEL SECURITY;

   CREATE POLICY "Admins manage answer keys"
   ON public.exam_question_answers FOR ALL TO authenticated
   USING (is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'super_admin'::app_role))
   WITH CHECK (is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'super_admin'::app_role));

   CREATE POLICY "Service role full access"
   ON public.exam_question_answers FOR ALL TO service_role
   USING (true) WITH CHECK (true);
   ```

2. **Backfill** existing answers from `exam_questions.correct_answer` into the new table.

3. **Sync triggers** to keep things working while the existing UI still writes `correct_answer` on `exam_questions`:
   - `BEFORE INSERT/UPDATE` trigger on `exam_questions` that mirrors `correct_answer` → `exam_question_answers` (running as SECURITY DEFINER so unit leaders can author questions without touching the answers table directly), then **clears** `NEW.correct_answer = NULL` so the column on `exam_questions` is never persisted with the value.
   - Result: `exam_questions.correct_answer` becomes effectively always NULL post-migration; only admins (and the `grade-exam` service-role function) can read the real value from `exam_question_answers`.

4. **Tighten the existing RESTRICTIVE SELECT policy** on `exam_questions` so non-admins can still read question text/options (the column is now empty for them anyway, but defense-in-depth):
   - Keep current restrictive policy as-is — unit leaders can still SELECT the row; they just won't get any meaningful `correct_answer` value because the column is null.

### Edge function update
- `supabase/functions/grade-exam/index.ts` — switch the answer lookup from `exam_questions.correct_answer` to `exam_question_answers.correct_answer` (joined on `question_id`). Service-role client already bypasses RLS.

### Optional column drop (deferred)
After verifying everything works, a follow-up could `ALTER TABLE exam_questions DROP COLUMN correct_answer`. Not doing it now to avoid breaking the admin authoring UI in `SubjectManager.jsx`/question-editor components in the same pass — the trigger already neutralises the column. I'll list this as a follow-up.

## Files
- **Migration**: new `exam_question_answers` table + RLS, backfill, sync trigger, leave restrictive policy on `exam_questions` intact.
- **Edit**: `supabase/functions/grade-exam/index.ts` — read answer key from new table.
- **No client changes needed** — admin/leader UIs continue writing `correct_answer` to `exam_questions`; trigger relays it.

After approval I'll inspect `grade-exam/index.ts` and the question-editor component to confirm the trigger's "clear column" behaviour doesn't break the editor's "edit existing question" flow (will fall back to reading from `exam_question_answers` for admins if needed).
