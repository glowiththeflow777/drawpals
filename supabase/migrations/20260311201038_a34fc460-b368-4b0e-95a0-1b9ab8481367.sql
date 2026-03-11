
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
      SET amount_invoiced = amount_invoiced + NEW.grand_total,
          amount_paid = amount_paid + NEW.grand_total
      WHERE id = NEW.project_id;
    -- Status changed FROM approved to something else
    ELSIF OLD.status = 'approved' AND NEW.status != 'approved' THEN
      UPDATE public.projects
      SET amount_invoiced = amount_invoiced - OLD.grand_total,
          amount_paid = amount_paid - OLD.grand_total
      WHERE id = OLD.project_id;
    END IF;
  ELSIF TG_OP = 'DELETE' AND OLD.status = 'approved' THEN
    UPDATE public.projects
    SET amount_invoiced = amount_invoiced - OLD.grand_total,
        amount_paid = amount_paid - OLD.grand_total
    WHERE id = OLD.project_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;
