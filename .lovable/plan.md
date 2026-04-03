
## Budget Import Redesign

### How it works
1. **Single CSV upload** on the Project Portal → Budget tab
2. **Auto-parse** the JobTread format (known columns, no manual mapping needed)
3. **Auto-split** into two budget tiers:
   - **Master Budget** (`budget_line_items`): ALL line items using `Extended Price` as the amount. This is the client-facing budget.
   - **Subcontractor Budget** (`sub_budget_line_items` via `sub_budgets`): Only rows where `Cost Type` = `Labor` or `Subcontractor`, using `Extended Cost` as the amount. This is what subs bill against.
4. **Materials** rows only appear on the master budget (not assigned to subs)
5. **Cost Group hierarchy** is preserved: the semicolon-separated `Cost Group` field maps to the `cost_group` column, with the top-level (`Interior Build-Out` / `Exterior Build-Out`) used for categorization

### Data mapping (CSV → DB)

| CSV Column | Master Budget Field | Sub Budget Field |
|---|---|---|
| Cost Group | cost_group (full path) | cost_group (full path) |
| Cost Item Name | cost_item_name | cost_item_name |
| Description | description | description |
| Quantity | quantity | quantity |
| Unit | unit | unit |
| Extended Price | extended_cost (master) | — |
| Extended Cost | — | extended_cost (sub) |
| Cost Type | cost_type | cost_type |
| (auto) | line_item_no (sequential) | line_item_no (sequential) |
| (filename) | batch_label | batch_label |

### UI changes
- Replace the 3-step column mapping wizard with a simple **"Import JobTread Budget"** button
- Upload CSV → show a preview summary (counts by cost type, totals) → confirm import
- On confirm: parse and insert master + sub budget rows in one operation
- The admin selects which subcontractor (team member) the sub budget is assigned to

### What stays the same
- Budget table display with batch grouping and cost group hierarchy
- Delete budget batch functionality
- Invoice wizard billing against sub budget line items
- All existing RLS policies

### Files to modify
- `src/pages/ProjectPortal.tsx` — replace import wizard trigger with new flow
- `src/components/SubcontractorBudgets.tsx` — update import flow
- `src/hooks/useProjects.ts` — new import mutation
- Create new component: `src/components/BudgetImport.tsx` — the new import dialog
- Remove or simplify old column mapping wizard components if they exist
