
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS pm_fee_rate numeric NOT NULL DEFAULT 0.10,
  ADD COLUMN IF NOT EXISTS master_budget numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sub_bid_total numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_sub_paid numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS jobtread_job_id text NOT NULL DEFAULT '';
