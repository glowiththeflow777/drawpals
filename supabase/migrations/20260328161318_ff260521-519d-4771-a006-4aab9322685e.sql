
ALTER TABLE public.pm_draw_sheets ADD COLUMN IF NOT EXISTS rejection_notes text NOT NULL DEFAULT '';
