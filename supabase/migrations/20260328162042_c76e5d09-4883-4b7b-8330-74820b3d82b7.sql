
CREATE OR REPLACE FUNCTION public.auto_pay_on_draw_sheet_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _total_fee numeric;
BEGIN
  -- Only fire when status changes TO 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    _total_fee := (NEW.interior_buildout_billed * 0.10)
                + (NEW.interior_construction_billed * 0.05)
                + (NEW.exterior_billed * 0.05);

    -- Insert an automatic payment record
    INSERT INTO public.pm_draw_payments (draw_sheet_id, payment_date, amount, notes)
    VALUES (NEW.id, CURRENT_DATE, _total_fee, 'Auto-recorded on approval');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_pay_draw_sheet_approval
  AFTER UPDATE ON public.pm_draw_sheets
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_pay_on_draw_sheet_approval();
