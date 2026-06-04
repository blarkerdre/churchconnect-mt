
CREATE OR REPLACE FUNCTION public.unit_task_autocomplete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total INT;
  v_done INT;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'Completed')
    INTO v_total, v_done
  FROM public.unit_task_assignments
  WHERE task_id = NEW.task_id;

  IF v_total > 0 AND v_done = v_total THEN
    UPDATE public.unit_tasks
       SET status = 'Completed', updated_at = now()
     WHERE id = NEW.task_id AND status <> 'Completed';
  ELSE
    UPDATE public.unit_tasks
       SET status = 'Open', updated_at = now()
     WHERE id = NEW.task_id AND status = 'Completed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_uta_autocomplete ON public.unit_task_assignments;
CREATE TRIGGER trg_uta_autocomplete
AFTER INSERT OR UPDATE OF status OR DELETE ON public.unit_task_assignments
FOR EACH ROW EXECUTE FUNCTION public.unit_task_autocomplete();

-- Backfill: mark tasks completed if all current assignments are completed
UPDATE public.unit_tasks t
   SET status = 'Completed', updated_at = now()
 WHERE status = 'Open'
   AND EXISTS (SELECT 1 FROM public.unit_task_assignments a WHERE a.task_id = t.id)
   AND NOT EXISTS (
     SELECT 1 FROM public.unit_task_assignments a
      WHERE a.task_id = t.id AND a.status <> 'Completed'
   );
