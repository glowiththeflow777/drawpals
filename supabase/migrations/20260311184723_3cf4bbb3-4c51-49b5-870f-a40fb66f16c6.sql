
-- Create project_documents table
CREATE TABLE public.project_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  document_type TEXT NOT NULL DEFAULT 'budget',
  notes TEXT NOT NULL DEFAULT '',
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_documents ENABLE ROW LEVEL SECURITY;

-- Admins full access
CREATE POLICY "Admins full access to project_documents"
ON public.project_documents
FOR ALL
TO authenticated
USING (get_user_role(auth.uid()) = 'admin')
WITH CHECK (get_user_role(auth.uid()) = 'admin');

-- Assigned users can view documents
CREATE POLICY "Assigned users can view project documents"
ON public.project_documents
FOR SELECT
TO authenticated
USING (is_assigned_to_project(auth.uid(), project_id));

-- Create storage bucket for project documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-documents', 'project-documents', false);

-- Storage RLS: Admins can upload
CREATE POLICY "Admins can upload project documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'project-documents'
  AND (SELECT get_user_role(auth.uid())) = 'admin'
);

-- Storage RLS: Admins can read
CREATE POLICY "Admins can read project documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'project-documents'
  AND (SELECT get_user_role(auth.uid())) = 'admin'
);

-- Storage RLS: Admins can delete
CREATE POLICY "Admins can delete project documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'project-documents'
  AND (SELECT get_user_role(auth.uid())) = 'admin'
);
