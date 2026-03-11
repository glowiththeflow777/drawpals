
-- Create enum for invitation status
CREATE TYPE public.invitation_status AS ENUM ('invited', 'pending', 'active');

-- Add invitation_status column to project_assignments
ALTER TABLE public.project_assignments
  ADD COLUMN invitation_status public.invitation_status NOT NULL DEFAULT 'active';

-- Add invited_at column to track when invitation was sent
ALTER TABLE public.project_assignments
  ADD COLUMN invited_at timestamp with time zone;
