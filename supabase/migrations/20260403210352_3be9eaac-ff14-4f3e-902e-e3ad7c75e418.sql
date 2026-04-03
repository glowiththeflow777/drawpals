
-- Create a trigger function that recalculates total_budget from budget_line_items
CREATE OR REPLACE FUNCTION public.sync_project_total_budget()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _project_id uuid;
  _new_total numeric;
BEGIN
  -- Determine which project to update
  IF TG_OP = 'DELETE' THEN
    _project_id := OLD.project_id;
  ELSE
    _project_id := NEW.project_id;
  END IF;

  -- Recalculate total from all budget line items
  SELECT COALESCE(SUM(extended_cost), 0) INTO _new_total
  FROM public.budget_line_items
  WHERE project_id = _project_id;

  UPDATE public.projects
  SET total_budget = _new_total
  WHERE id = _project_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attach trigger to budget_line_items
CREATE TRIGGER trg_sync_project_total_budget
  AFTER INSERT OR UPDATE OR DELETE ON public.budget_line_items
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_project_total_budget();

-- Fix current out-of-sync projects
UPDATE public.projects p
SET total_budget = sub.actual_total
FROM (
  SELECT project_id, COALESCE(SUM(extended_cost), 0) as actual_total
  FROM public.budget_line_items
  GROUP BY project_id
) sub
WHERE p.id = sub.project_id;
