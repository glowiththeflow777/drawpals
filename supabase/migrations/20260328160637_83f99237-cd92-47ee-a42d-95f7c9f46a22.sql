
-- PM Draw Sheets: one per project, stores cumulative billing state
CREATE TABLE public.pm_draw_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  pm_user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  interior_buildout_billed numeric NOT NULL DEFAULT 0,
  interior_construction_billed numeric NOT NULL DEFAULT 0,
  exterior_billed numeric NOT NULL DEFAULT 0,
  notes text NOT NULL DEFAULT '',
  last_updated date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, pm_user_id)
);

ALTER TABLE public.pm_draw_sheets ENABLE ROW LEVEL SECURITY;

-- PMs can manage their own draw sheets
CREATE POLICY "PMs manage own draw sheets" ON public.pm_draw_sheets
  FOR ALL TO authenticated
  USING (pm_user_id = auth.uid())
  WITH CHECK (pm_user_id = auth.uid());

-- Admins full access
CREATE POLICY "Admins full access to pm_draw_sheets" ON public.pm_draw_sheets
  FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'admin')
  WITH CHECK (get_user_role(auth.uid()) = 'admin');

-- PM Draw Payments: tracks payments already received by PM
CREATE TABLE public.pm_draw_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draw_sheet_id uuid NOT NULL REFERENCES public.pm_draw_sheets(id) ON DELETE CASCADE,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric NOT NULL DEFAULT 0,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pm_draw_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "PMs manage own draw payments" ON public.pm_draw_payments
  FOR ALL TO authenticated
  USING (draw_sheet_id IN (SELECT id FROM public.pm_draw_sheets WHERE pm_user_id = auth.uid()))
  WITH CHECK (draw_sheet_id IN (SELECT id FROM public.pm_draw_sheets WHERE pm_user_id = auth.uid()));

CREATE POLICY "Admins full access to pm_draw_payments" ON public.pm_draw_payments
  FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'admin')
  WITH CHECK (get_user_role(auth.uid()) = 'admin');

-- PM Sub Pay Entries: tracks sub payments for bonus calculation
CREATE TABLE public.pm_sub_pay_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draw_sheet_id uuid NOT NULL REFERENCES public.pm_draw_sheets(id) ON DELETE CASCADE,
  sub_name text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pm_sub_pay_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "PMs manage own sub pay entries" ON public.pm_sub_pay_entries
  FOR ALL TO authenticated
  USING (draw_sheet_id IN (SELECT id FROM public.pm_draw_sheets WHERE pm_user_id = auth.uid()))
  WITH CHECK (draw_sheet_id IN (SELECT id FROM public.pm_draw_sheets WHERE pm_user_id = auth.uid()));

CREATE POLICY "Admins full access to pm_sub_pay_entries" ON public.pm_sub_pay_entries
  FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'admin')
  WITH CHECK (get_user_role(auth.uid()) = 'admin');

-- Updated at trigger for draw sheets
CREATE TRIGGER update_pm_draw_sheets_updated_at
  BEFORE UPDATE ON public.pm_draw_sheets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
