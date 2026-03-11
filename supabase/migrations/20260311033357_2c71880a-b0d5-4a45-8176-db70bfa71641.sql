
-- Security definer function to get current user's role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = _user_id LIMIT 1;
$$;

-- Security definer function to check if user is assigned to a project
CREATE OR REPLACE FUNCTION public.is_assigned_to_project(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_assignments pa
    JOIN public.profiles p ON p.team_member_id = pa.team_member_id
    WHERE p.id = _user_id AND pa.project_id = _project_id
  );
$$;

-- Drop existing permissive policies on projects
DROP POLICY IF EXISTS "Allow all access to projects" ON public.projects;

-- Projects: admins see all, others see only assigned
CREATE POLICY "Admins full access to projects" ON public.projects
FOR ALL TO authenticated
USING (public.get_user_role(auth.uid()) = 'admin')
WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "PM and subs see assigned projects" ON public.projects
FOR SELECT TO authenticated
USING (public.is_assigned_to_project(auth.uid(), id));

-- Drop existing permissive policies on budget_line_items
DROP POLICY IF EXISTS "Allow all access to budget_line_items" ON public.budget_line_items;

-- Budget items: admins full access, others read only assigned project items
CREATE POLICY "Admins full access to budget_line_items" ON public.budget_line_items
FOR ALL TO authenticated
USING (public.get_user_role(auth.uid()) = 'admin')
WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Users see budget items for assigned projects" ON public.budget_line_items
FOR SELECT TO authenticated
USING (public.is_assigned_to_project(auth.uid(), project_id));

-- Drop existing permissive policies on project_assignments
DROP POLICY IF EXISTS "Allow all access to project_assignments" ON public.project_assignments;

-- Project assignments: admins manage all, others see own
CREATE POLICY "Admins full access to project_assignments" ON public.project_assignments
FOR ALL TO authenticated
USING (public.get_user_role(auth.uid()) = 'admin')
WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Users see own project assignments" ON public.project_assignments
FOR SELECT TO authenticated
USING (
  team_member_id IN (
    SELECT tm_id FROM (SELECT team_member_id as tm_id FROM public.profiles WHERE id = auth.uid()) sub
  )
);

-- Drop existing permissive policies on team_members
DROP POLICY IF EXISTS "Allow all access to team_members" ON public.team_members;

-- Team members: admins manage all, others can read
CREATE POLICY "Admins full access to team_members" ON public.team_members
FOR ALL TO authenticated
USING (public.get_user_role(auth.uid()) = 'admin')
WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Authenticated users can read team_members" ON public.team_members
FOR SELECT TO authenticated
USING (true);

-- Create notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL DEFAULT '',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own notifications" ON public.notifications
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications" ON public.notifications
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Function to create notifications when a team member is assigned to a project
CREATE OR REPLACE FUNCTION public.notify_project_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _project_name text;
  _profile_user_id uuid;
BEGIN
  -- Get the project name
  SELECT name INTO _project_name FROM public.projects WHERE id = NEW.project_id;
  
  -- Get the auth user id from profiles via team_member_id
  SELECT id INTO _profile_user_id FROM public.profiles WHERE team_member_id = NEW.team_member_id;
  
  -- Only create notification if we found a matching profile
  IF _profile_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message)
    VALUES (
      _profile_user_id,
      'New Project Assignment',
      'You have been assigned to project: ' || COALESCE(_project_name, 'Unknown Project')
    );
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_project_assignment_created
AFTER INSERT ON public.project_assignments
FOR EACH ROW EXECUTE FUNCTION public.notify_project_assignment();
