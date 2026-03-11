
-- Drop the old trigger that updates on every INSERT
DROP TRIGGER IF EXISTS trg_update_project_invoiced ON public.invoices;

-- Replace with a trigger that only updates amount_invoiced when status changes to 'approved'
-- and reverses it if status changes away from 'approved'
CREATE OR REPLACE FUNCTION public.update_project_invoiced_amount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Status changed TO approved
    IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
      UPDATE public.projects
      SET amount_invoiced = amount_invoiced + NEW.grand_total
      WHERE id = NEW.project_id;
    -- Status changed FROM approved to something else
    ELSIF OLD.status = 'approved' AND NEW.status != 'approved' THEN
      UPDATE public.projects
      SET amount_invoiced = amount_invoiced - OLD.grand_total
      WHERE id = OLD.project_id;
    END IF;
  ELSIF TG_OP = 'DELETE' AND OLD.status = 'approved' THEN
    UPDATE public.projects
    SET amount_invoiced = amount_invoiced - OLD.grand_total
    WHERE id = OLD.project_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Re-create trigger for UPDATE and DELETE only (not INSERT)
CREATE TRIGGER trg_update_project_invoiced
  AFTER UPDATE OR DELETE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_project_invoiced_amount();

-- Add rejection_notes column to invoices
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS rejection_notes text DEFAULT '';

-- Allow admins to update invoices (already covered by ALL policy, but let's also allow PM)
