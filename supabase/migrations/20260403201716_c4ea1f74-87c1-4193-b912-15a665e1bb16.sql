
-- Add proposal fields to sub_budgets
ALTER TABLE public.sub_budgets
  ADD COLUMN IF NOT EXISTS proposal_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bid_percentage numeric NOT NULL DEFAULT 100;

-- Add contract_price to sub_budget_line_items
ALTER TABLE public.sub_budget_line_items
  ADD COLUMN IF NOT EXISTS contract_price numeric NOT NULL DEFAULT 0;

-- Add sub_budget_line_item_id to invoice_line_items (nullable for backward compat)
ALTER TABLE public.invoice_line_items
  ADD COLUMN IF NOT EXISTS sub_budget_line_item_id uuid REFERENCES public.sub_budget_line_items(id);
