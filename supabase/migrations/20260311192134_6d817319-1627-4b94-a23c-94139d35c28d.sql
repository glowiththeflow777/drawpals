
ALTER TABLE public.budget_line_items
ADD COLUMN batch_label text NOT NULL DEFAULT '';
