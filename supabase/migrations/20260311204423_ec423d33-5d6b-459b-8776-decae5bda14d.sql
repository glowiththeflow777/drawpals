
CREATE TABLE public.invoice_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  budget_line_item_id uuid NOT NULL REFERENCES public.budget_line_items(id) ON DELETE CASCADE,
  line_item_no integer NOT NULL DEFAULT 0,
  description text NOT NULL DEFAULT '',
  contract_price numeric NOT NULL DEFAULT 0,
  percent_complete numeric NOT NULL DEFAULT 0,
  draw_amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;

-- Admins full access
CREATE POLICY "Admins full access to invoice_line_items"
  ON public.invoice_line_items FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'admin')
  WITH CHECK (get_user_role(auth.uid()) = 'admin');

-- Users can insert their own invoice line items
CREATE POLICY "Users can insert own invoice line items"
  ON public.invoice_line_items FOR INSERT TO authenticated
  WITH CHECK (
    invoice_id IN (SELECT id FROM public.invoices WHERE submitted_by = auth.uid())
  );

-- Users can view own invoice line items
CREATE POLICY "Users can view own invoice line items"
  ON public.invoice_line_items FOR SELECT TO authenticated
  USING (
    invoice_id IN (SELECT id FROM public.invoices WHERE submitted_by = auth.uid())
  );

-- Assigned users can view project invoice line items
CREATE POLICY "Assigned users can view project invoice line items"
  ON public.invoice_line_items FOR SELECT TO authenticated
  USING (
    invoice_id IN (
      SELECT i.id FROM public.invoices i
      WHERE is_assigned_to_project(auth.uid(), i.project_id)
    )
  );
