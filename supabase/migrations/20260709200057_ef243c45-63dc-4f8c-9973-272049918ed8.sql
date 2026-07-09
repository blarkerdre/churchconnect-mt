CREATE OR REPLACE FUNCTION public.enforce_exam_answer_correctness()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _correct_answer text;
BEGIN
  SELECT correct_answer INTO _correct_answer
  FROM public.exam_question_answers
  WHERE question_id = NEW.question_id;

  IF _correct_answer IS NOT NULL THEN
    NEW.is_correct := (NEW.selected_answer = _correct_answer);
  ELSE
    NEW.is_correct := COALESCE(NEW.is_correct, false);
  END IF;

  RETURN NEW;
END;
$$;