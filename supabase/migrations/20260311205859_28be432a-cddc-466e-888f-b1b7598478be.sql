
-- Subcontractor budgets: one per sub per project
CREATE TABLE public.sub_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  team_member_id uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL,
  file_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, team_member_id)
);

ALTER TABLE public.sub_budgets ENABLE ROW LEVEL SECURITY;

-- Admins full access
CREATE POLICY "Admins full access to sub_budgets"
  ON public.sub_budgets FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'admin')
  WITH CHECK (get_user_role(auth.uid()) = 'admin');

-- PMs can manage sub budgets for their assigned projects
CREATE POLICY "PMs manage sub_budgets for assigned projects"
  ON public.sub_budgets FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'project-manager' AND is_assigned_to_project(auth.uid(), project_id))
  WITH CHECK (get_user_role(auth.uid()) = 'project-manager' AND is_assigned_to_project(auth.uid(), project_id));

-- Subs can view their own budgets
CREATE POLICY "Subs view own sub_budgets"
  ON public.sub_budgets FOR SELECT TO authenticated
  USING (
    team_member_id IN (
      SELECT p.team_member_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

-- Sub budget line items
CREATE TABLE public.sub_budget_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_budget_id uuid NOT NULL REFERENCES public.sub_budgets(id) ON DELETE CASCADE,
  line_item_no integer NOT NULL DEFAULT 0,
  cost_group text NOT NULL DEFAULT '',
  cost_item_name text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  quantity numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'Each',
  extended_cost numeric NOT NULL DEFAULT 0,
  cost_type text NOT NULL DEFAULT 'Labor',
  cost_code text NOT NULL DEFAULT '',
  batch_label text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sub_budget_line_items ENABLE ROW LEVEL SECURITY;

-- Admins full access
CREATE POLICY "Admins full access to sub_budget_line_items"
  ON public.sub_budget_line_items FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'admin')
  WITH CHECK (get_user_role(auth.uid()) = 'admin');

-- PMs can manage for assigned projects
CREATE POLICY "PMs manage sub_budget_line_items"
  ON public.sub_budget_line_items FOR ALL TO authenticated
  USING (
    get_user_role(auth.uid()) = 'project-manager'
    AND sub_budget_id IN (
      SELECT sb.id FROM public.sub_budgets sb WHERE is_assigned_to_project(auth.uid(), sb.project_id)
    )
  )
  WITH CHECK (
    get_user_role(auth.uid()) = 'project-manager'
    AND sub_budget_id IN (
      SELECT sb.id FROM public.sub_budgets sb WHERE is_assigned_to_project(auth.uid(), sb.project_id)
    )
  );

-- Subs can view their own budget line items
CREATE POLICY "Subs view own sub_budget_line_items"
  ON public.sub_budget_line_items FOR SELECT TO authenticated
  USING (
    sub_budget_id IN (
      SELECT sb.id FROM public.sub_budgets sb
      WHERE sb.team_member_id IN (
        SELECT p.team_member_id FROM public.profiles p WHERE p.id = auth.uid()
      )
    )
  );
