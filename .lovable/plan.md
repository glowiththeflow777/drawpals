
## Sub Proposal & Simplified Billing System

### Overview
Replace the CSV-based sub budget upload with a **proposal builder** where Admin/PM picks master budget line items, sets a contract price (defaulting to a % of Extended Cost, adjustable), and assigns to a subcontractor. Subs then bill by entering cumulative **% complete** — the system auto-calculates draw amounts.

---

### Flow 1: Admin/PM Creates a Sub Proposal

1. On the Project Portal → Subcontractor Budgets section, click **"Create Proposal"**
2. Select a subcontractor (team member) from dropdown
3. See the full master budget line items in a checklist
4. Check off items to include in this sub's scope
5. **Batch pricing**: Enter a percentage (e.g. 60%) → system applies it to all selected items' Extended Cost to generate contract prices
6. **Fine-tune**: Admin can override individual item contract prices if needed
7. Set a **proposal name** (e.g. "Phase 1 - Framing", "Electrical Rough-In")
8. Click **Save Proposal** → creates the sub_budget + sub_budget_line_items with contract prices
9. Multiple proposals per sub per project are allowed

### Flow 2: Sub Submits an Invoice (Simplified Billing)

1. Sub clicks **Submit Invoice** on their project
2. System loads all their proposal line items (across all proposals for that project)
3. For each item, sub sees:
   - Description & contract price
   - Previous % complete (from prior invoices)
   - Input field: **new cumulative % complete** (e.g. "75%")
   - Auto-calculated: **This period's draw** = `(new% - old%) × contract price`
4. Grand total auto-sums all draw amounts
5. Sub adds invoice number, notes, attachments → Submit

### Database Changes

**Modify `sub_budget_line_items`**:
- Add `contract_price` (numeric, default 0) — the proposal price for this item (distinct from `extended_cost` which is the raw CSV cost)

**Modify `sub_budgets`**:
- Add `proposal_name` (text, default '') — descriptive label for the proposal
- Add `bid_percentage` (numeric, default 100) — the default % applied when creating

**Modify `invoice_line_items`**:
- Change `budget_line_item_id` to reference `sub_budget_line_items` instead of `budget_line_items` (or add `sub_budget_line_item_id`)
- The `percent_complete` field already exists — this becomes the cumulative % to date
- The `draw_amount` already exists — this becomes the calculated period amount

### UI Changes

**Remove**: 
- "Upload Sub Budget" CSV dialog from SubcontractorBudgets component

**New Component**: `SubProposalBuilder.tsx`
- Checklist of master budget items grouped by cost group
- Batch % input + individual override
- Assign to sub + proposal name

**Modify**: Invoice Wizard (Step 3 - Line Items)
- Instead of manual dollar amounts, show sub's proposal items
- Input: cumulative % complete slider/field (0-100)
- Display: contract price, previously billed %, this period draw (auto-calc)
- Remove manual "draw amount" input

**Modify**: SubcontractorBudgets display
- Show proposals with their names, sub assignments, and totals
- Allow editing/deleting proposals

### What stays the same
- Master budget import (CSV → budget_line_items) — untouched
- RLS policies structure (admin full, subs see own)
- Invoice approval workflow
- PM draw sheets

### Files to modify
- `src/components/SubcontractorBudgets.tsx` — remove CSV upload, add proposal list + create button
- `src/pages/InvoiceWizard.tsx` — refactor step 3 for % complete billing
- `src/hooks/useProjects.ts` — add proposal CRUD mutations
- Create: `src/components/SubProposalBuilder.tsx` — the proposal creation dialog
- Migration: add `contract_price` to sub_budget_line_items, `proposal_name`/`bid_percentage` to sub_budgets
