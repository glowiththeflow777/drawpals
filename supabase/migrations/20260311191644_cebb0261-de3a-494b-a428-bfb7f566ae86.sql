
CREATE TABLE public.subcontractor_directory (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name text NOT NULL,
  contact_name text NOT NULL DEFAULT '',
  subcontractor_type text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  specialties text[] NOT NULL DEFAULT '{}',
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  website text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.subcontractor_directory ENABLE ROW LEVEL SECURITY;

-- All authenticated team members can view the directory
CREATE POLICY "Authenticated users can view directory"
  ON public.subcontractor_directory
  FOR SELECT
  TO authenticated
  USING (true);

-- All authenticated users can add entries
CREATE POLICY "Authenticated users can insert directory"
  ON public.subcontractor_directory
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Users can update entries they created, admins can update all
CREATE POLICY "Users update own or admin updates all"
  ON public.subcontractor_directory
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid() OR get_user_role(auth.uid()) = 'admin')
  WITH CHECK (created_by = auth.uid() OR get_user_role(auth.uid()) = 'admin');

-- Users can delete entries they created, admins can delete all
CREATE POLICY "Users delete own or admin deletes all"
  ON public.subcontractor_directory
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid() OR get_user_role(auth.uid()) = 'admin');
