import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';

export type DbProject = Tables<'projects'>;
export type DbBudgetLineItem = Tables<'budget_line_items'>;
export type DbTeamMember = Tables<'team_members'>;
export type DbProjectAssignment = Tables<'project_assignments'>;

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as DbProject[];
    },
  });
}

export function useBudgetLineItems(projectId?: string) {
  return useQuery({
    queryKey: ['budget_line_items', projectId],
    queryFn: async () => {
      let query = supabase.from('budget_line_items').select('*');
      if (projectId) query = query.eq('project_id', projectId);
      const { data, error } = await query.order('line_item_no');
      if (error) throw error;
      return data as DbBudgetLineItem[];
    },
  });
}

export function useTeamMembers() {
  return useQuery({
    queryKey: ['team_members'],
    queryFn: async () => {
      const { data, error } = await supabase.from('team_members').select('*').order('name');
      if (error) throw error;
      return data as DbTeamMember[];
    },
  });
}

export type DbSubcontractorDirectory = Tables<'subcontractor_directory'>;

export function useSubcontractorDirectory() {
  return useQuery({
    queryKey: ['subcontractor_directory'],
    queryFn: async () => {
      const { data, error } = await supabase.from('subcontractor_directory').select('*').order('company_name');
      if (error) throw error;
      return data as DbSubcontractorDirectory[];
    },
  });
}

export function useProjectAssignments(projectId?: string) {
  return useQuery({
    queryKey: ['project_assignments', projectId],
    queryFn: async () => {
      let query = supabase.from('project_assignments').select('*, team_members(*)');
      if (projectId) query = query.eq('project_id', projectId);
      const { data, error } = await query;
      if (error) throw error;
      // Cast to include the new columns that aren't in generated types yet
      return data as (typeof data[number] & { invitation_status?: string; invited_at?: string })[];
    },
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (project: TablesInsert<'projects'>) => {
      const { data, error } = await supabase.from('projects').insert(project).select().single();
      if (error) throw error;
      return data as DbProject;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<DbProject> & { id: string }) => {
      const { data, error } = await supabase.from('projects').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data as DbProject;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });
}

export function useInsertBudgetLineItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: TablesInsert<'budget_line_items'>[]) => {
      const { data, error } = await supabase.from('budget_line_items').insert(items).select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budget_line_items'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useUpdateBudgetDrawCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, costGroup, drawCategory }: { projectId: string; costGroup: string; drawCategory: string }) => {
      const { error } = await supabase
        .from('budget_line_items')
        .update({ draw_category: drawCategory } as any)
        .eq('project_id', projectId)
        .eq('cost_group', costGroup);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budget_line_items'] }),
  });
}

export function useCreateTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (member: TablesInsert<'team_members'>) => {
      const { data, error } = await supabase.from('team_members').insert(member).select().single();
      if (error) throw error;
      return data as DbTeamMember;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team_members'] }),
  });
}

export function useUpdateTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<DbTeamMember> & { id: string }) => {
      const { data, error } = await supabase.from('team_members').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data as DbTeamMember;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team_members'] }),
  });
}

export function useDeleteTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('team_members').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team_members'] });
      qc.invalidateQueries({ queryKey: ['project_assignments'] });
    },
  });
}

export function useToggleAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, teamMemberId }: { projectId: string; teamMemberId: string }) => {
      // Check if assignment exists
      const { data: existing } = await supabase
        .from('project_assignments')
        .select('id')
        .eq('project_id', projectId)
        .eq('team_member_id', teamMemberId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase.from('project_assignments').delete().eq('id', existing.id);
        if (error) throw error;
        return { action: 'removed' as const };
      } else {
        const { error } = await supabase.from('project_assignments').insert({ project_id: projectId, team_member_id: teamMemberId });
        if (error) throw error;
        return { action: 'added' as const };
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project_assignments'] }),
  });
}

export function useAddAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, teamMemberId, status }: { projectId: string; teamMemberId: string; status: string }) => {
      const { error } = await supabase.from('project_assignments').insert({
        project_id: projectId,
        team_member_id: teamMemberId,
        invitation_status: status as any,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project_assignments'] }),
  });
}

export function useUpdateAssignmentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ assignmentId, status }: { assignmentId: string; status: string }) => {
      const { error } = await supabase
        .from('project_assignments')
        .update({ invitation_status: status as any })
        .eq('id', assignmentId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project_assignments'] }),
  });
}

export function useInvoices(projectId?: string) {
  return useQuery({
    queryKey: ['invoices', projectId],
    queryFn: async () => {
      let query = supabase.from('invoices').select('*');
      if (projectId) query = query.eq('project_id', projectId);
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (invoice: {
      project_id: string;
      submitted_by: string;
      subcontractor_name: string;
      invoice_number: string;
      invoice_date: string;
      sow_total: number;
      day_labor_total: number;
      reimbursement_total: number;
      change_order_total: number;
      credit_total: number;
      grand_total: number;
      notes: string;
      line_items?: {
        budget_line_item_id: string;
        sub_budget_line_item_id?: string;
        line_item_no: number;
        description: string;
        contract_price: number;
        percent_complete: number;
        draw_amount: number;
      }[];
    }) => {
      const { line_items, ...invoiceData } = invoice;
      const { data, error } = await supabase.from('invoices').insert(invoiceData).select().single();
      if (error) throw error;

      // Insert line items if provided
      if (line_items && line_items.length > 0) {
        const rows = line_items.map(li => ({
          invoice_id: data.id,
          budget_line_item_id: li.budget_line_item_id,
          sub_budget_line_item_id: li.sub_budget_line_item_id || null,
          line_item_no: li.line_item_no,
          description: li.description,
          contract_price: li.contract_price,
          percent_complete: li.percent_complete,
          draw_amount: li.draw_amount,
        }));
        const { error: liError } = await supabase.from('invoice_line_items' as any).insert(rows);
        if (liError) console.error('Line items insert error:', liError);
      }

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['invoice_line_items_billing'] });
    },
  });
}

export function useDeleteInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (invoiceId: string) => {
      // Delete line items first (FK constraint)
      const { error: lineError } = await supabase
        .from('invoice_line_items')
        .delete()
        .eq('invoice_id', invoiceId);
      if (lineError) throw lineError;

      // Delete the invoice (DB trigger handles project amount adjustments)
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoiceId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['invoice_line_items_billing'] });
    },
  });
}

// Fetch total billed per budget line item for a project (across all approved/submitted invoices)
export function useBillingHistory(projectId?: string) {
  return useQuery({
    queryKey: ['invoice_line_items_billing', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      // Get all invoice_line_items for invoices in this project
      const { data, error } = await supabase
        .from('invoice_line_items' as any)
        .select('budget_line_item_id, draw_amount, invoice_id, invoices!inner(project_id, status)')
        .eq('invoices.project_id', projectId);
      if (error) throw error;

      // Sum draw_amount per budget_line_item_id (only for non-rejected invoices)
      const billedMap = new Map<string, number>();
      (data as any[])?.forEach((row: any) => {
        if (row.invoices?.status !== 'rejected') {
          const current = billedMap.get(row.budget_line_item_id) || 0;
          billedMap.set(row.budget_line_item_id, current + Number(row.draw_amount));
        }
      });
      return billedMap;
    },
  });
}

// Fetch detailed invoice line items for a project with invoice metadata
export function useInvoiceLineItemsDetailed(projectId?: string) {
  return useQuery({
    queryKey: ['invoice_line_items_detailed', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoice_line_items' as any)
        .select('*, invoices!inner(project_id, status, invoice_number, invoice_date, subcontractor_name)')
        .eq('invoices.project_id', projectId);
      if (error) throw error;
      return (data as any[]) || [];
    },
  });
}

// Sub budgets
export function useSubBudgets(projectId?: string) {
  return useQuery({
    queryKey: ['sub_budgets', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sub_budgets' as any)
        .select('*, team_members(id, name, email, role, crew_name)')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as any[]) || [];
    },
  });
}

export function useSubBudgetLineItems(subBudgetId?: string) {
  return useQuery({
    queryKey: ['sub_budget_line_items', subBudgetId],
    enabled: !!subBudgetId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sub_budget_line_items' as any)
        .select('*')
        .eq('sub_budget_id', subBudgetId)
        .order('line_item_no');
      if (error) throw error;
      return (data as any[]) || [];
    },
  });
}

export function useCreateSubBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      project_id: string;
      team_member_id: string;
      uploaded_by: string;
      file_name: string;
      line_items: {
        line_item_no: number;
        cost_group: string;
        cost_item_name: string;
        description: string;
        quantity: number;
        unit: string;
        extended_cost: number;
        cost_type: string;
        cost_code: string;
        batch_label: string;
      }[];
    }) => {
      const { line_items, ...budgetData } = params;
      const { data, error } = await supabase
        .from('sub_budgets' as any)
        .insert(budgetData)
        .select()
        .single();
      if (error) throw error;
      const budgetId = (data as any).id;

      // Delete old line items then insert new ones
      await supabase.from('sub_budget_line_items' as any).delete().eq('sub_budget_id', budgetId);
      if (line_items.length > 0) {
        const rows = line_items.map(li => ({ ...li, sub_budget_id: budgetId }));
        const { error: liErr } = await supabase.from('sub_budget_line_items' as any).insert(rows);
        if (liErr) throw liErr;
      }
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['sub_budgets', vars.project_id] });
      qc.invalidateQueries({ queryKey: ['sub_budget_line_items'] });
    },
  });
}

export function useDeleteSubBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ subBudgetId, projectId }: { subBudgetId: string; projectId: string }) => {
      // Delete line items first, then the budget
      await supabase.from('sub_budget_line_items' as any).delete().eq('sub_budget_id', subBudgetId);
      const { error } = await supabase.from('sub_budgets' as any).delete().eq('id', subBudgetId);
      if (error) throw error;
      return projectId;
    },
    onSuccess: (projectId) => {
      qc.invalidateQueries({ queryKey: ['sub_budgets', projectId] });
      qc.invalidateQueries({ queryKey: ['sub_budget_line_items'] });
      qc.invalidateQueries({ queryKey: ['sub_bid_total', projectId] });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useDeleteMasterBudgetBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, batchLabel }: { projectId: string; batchLabel: string }) => {
      const { error } = await supabase
        .from('budget_line_items')
        .delete()
        .eq('project_id', projectId)
        .eq('batch_label', batchLabel);
      if (error) throw error;

      // total_budget is auto-synced by database trigger on budget_line_items
      return projectId;
    },
    onSuccess: (projectId) => {
      qc.invalidateQueries({ queryKey: ['budget_line_items', projectId] });
      qc.invalidateQueries({ queryKey: ['budget_line_items'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

// Fetch sub budget line items for a specific sub in a project (for invoice wizard)
export function useSubBudgetForMember(projectId?: string, teamMemberId?: string) {
  return useQuery({
    queryKey: ['sub_budget_for_member', projectId, teamMemberId],
    enabled: !!projectId && !!teamMemberId,
    queryFn: async () => {
      const { data: budget, error: bErr } = await supabase
        .from('sub_budgets' as any)
        .select('id')
        .eq('project_id', projectId)
        .eq('team_member_id', teamMemberId)
        .maybeSingle();
      if (bErr) throw bErr;
      if (!budget) return [];
      const budgetId = (budget as any).id;
      const { data, error } = await supabase
        .from('sub_budget_line_items' as any)
        .select('*')
        .eq('sub_budget_id', budgetId)
        .order('line_item_no');
      if (error) throw error;
      return (data as any[]) || [];
    },
  });
}


// All sub_budget_line_items across all proposals for a project (for assignment tracking)
export function useAllSubBudgetLineItemsForProject(projectId?: string) {
  return useQuery({
    queryKey: ['all_sub_budget_line_items', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data: budgets, error: bErr } = await supabase
        .from('sub_budgets' as any)
        .select('id, team_member_id, proposal_name, file_name, team_members(name, crew_name)')
        .eq('project_id', projectId);
      if (bErr) throw bErr;
      if (!budgets || budgets.length === 0) return [];
      const budgetIds = (budgets as any[]).map(b => b.id);
      const { data, error } = await supabase
        .from('sub_budget_line_items' as any)
        .select('*')
        .in('sub_budget_id', budgetIds);
      if (error) throw error;
      // Attach budget metadata
      const budgetMap = new Map((budgets as any[]).map(b => [b.id, b]));
      return (data as any[]).map(item => ({
        ...item,
        _budget: budgetMap.get(item.sub_budget_id),
      }));
    },
  });
}


// PM draw payments for a project (sum of all payments across all draw sheets)
export function usePmDrawPaymentsForProject(projectId?: string) {
  return useQuery({
    queryKey: ['pm_draw_payments_project', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data: sheets, error: sErr } = await supabase
        .from('pm_draw_sheets')
        .select('id')
        .eq('project_id', projectId!);
      if (sErr) throw sErr;
      if (!sheets || sheets.length === 0) return 0;
      const sheetIds = sheets.map(s => s.id);
      const { data, error } = await supabase
        .from('pm_draw_payments')
        .select('amount')
        .in('draw_sheet_id', sheetIds);
      if (error) throw error;
      return (data || []).reduce((sum, p) => sum + Number(p.amount), 0);
    },
  });
}

// Sub budgets: internal cost total vs contracted proposal total
export function useSubBidTotal(projectId?: string) {
  return useQuery({
    queryKey: ['sub_bid_total', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data: budgets, error: bErr } = await supabase
        .from('sub_budgets')
        .select('id')
        .eq('project_id', projectId!);
      if (bErr) throw bErr;
      if (!budgets || budgets.length === 0) return { costTotal: 0, contractTotal: 0 };
      const budgetIds = budgets.map(b => b.id);
      const { data, error } = await supabase
        .from('sub_budget_line_items')
        .select('extended_cost, contract_price')
        .in('sub_budget_id', budgetIds);
      if (error) throw error;
      const costTotal = (data || []).reduce((sum, li) => sum + Number(li.extended_cost), 0);
      const contractTotal = (data || []).reduce((sum, li) => sum + Number(li.contract_price || li.extended_cost), 0);
      return { costTotal, contractTotal };
    },
  });
}

export function useRemoveAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ assignmentId }: { assignmentId: string }) => {
      const { error } = await supabase.from('project_assignments').delete().eq('id', assignmentId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project_assignments'] }),
  });
}

export function useUpdateInvoiceStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ invoiceId, status, rejectionNotes }: { invoiceId: string; status: string; rejectionNotes?: string }) => {
      const updates: Record<string, unknown> = { status };
      if (rejectionNotes !== undefined) updates.rejection_notes = rejectionNotes;
      const { error } = await supabase.from('invoices').update(updates as any).eq('id', invoiceId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}
