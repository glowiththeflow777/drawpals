
-- Create invoices table
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  submitted_by uuid NOT NULL,
  subcontractor_name text NOT NULL DEFAULT '',
  invoice_number text NOT NULL DEFAULT '',
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  period_start date,
  period_end date,
  sow_total numeric NOT NULL DEFAULT 0,
  day_labor_total numeric NOT NULL DEFAULT 0,
  reimbursement_total numeric NOT NULL DEFAULT 0,
  change_order_total numeric NOT NULL DEFAULT 0,
  credit_total numeric NOT NULL DEFAULT 0,
  grand_total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'submitted',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Admins full access
CREATE POLICY "Admins full access to invoices"
  ON public.invoices FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'admin')
  WITH CHECK (get_user_role(auth.uid()) = 'admin');

-- Submitter can view own invoices
CREATE POLICY "Users can view own invoices"
  ON public.invoices FOR SELECT TO authenticated
  USING (submitted_by = auth.uid());

-- Authenticated users can insert invoices (submitted_by must match)
CREATE POLICY "Users can submit invoices"
  ON public.invoices FOR INSERT TO authenticated
  WITH CHECK (submitted_by = auth.uid());

-- Assigned users can view project invoices
CREATE POLICY "Assigned users can view project invoices"
  ON public.invoices FOR SELECT TO authenticated
  USING (is_assigned_to_project(auth.uid(), project_id));

-- Trigger to update project amount_invoiced
CREATE OR REPLACE FUNCTION public.update_project_invoiced_amount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.projects
    SET amount_invoiced = amount_invoiced + NEW.grand_total
    WHERE id = NEW.project_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.projects
    SET amount_invoiced = amount_invoiced - OLD.grand_total
    WHERE id = OLD.project_id;
  ELSIF TG_OP = 'UPDATE' AND NEW.grand_total != OLD.grand_total THEN
    UPDATE public.projects
    SET amount_invoiced = amount_invoiced + (NEW.grand_total - OLD.grand_total)
    WHERE id = NEW.project_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_update_project_invoiced
AFTER INSERT OR UPDATE OR DELETE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.update_project_invoiced_amount();
