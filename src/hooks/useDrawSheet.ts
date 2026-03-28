import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Fetch the latest draft sheet for a project+PM (or null if none)
export function useDrawSheet(projectId?: string, pmUserId?: string) {
  return useQuery({
    queryKey: ['pm_draw_sheet', projectId, pmUserId],
    enabled: !!projectId && !!pmUserId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pm_draw_sheets' as any)
        .select('*')
        .eq('project_id', projectId)
        .eq('pm_user_id', pmUserId)
        .eq('status', 'draft')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });
}

// Fetch all non-draft (submitted/approved/rejected) sheets for billing history
export function useDrawSheetHistory(projectId?: string, pmUserId?: string) {
  return useQuery({
    queryKey: ['pm_draw_sheet_history', projectId, pmUserId],
    enabled: !!projectId && !!pmUserId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pm_draw_sheets' as any)
        .select('*')
        .eq('project_id', projectId)
        .eq('pm_user_id', pmUserId)
        .neq('status', 'draft')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as any[]) || [];
    },
  });
}

export function useUpsertDrawSheet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sheet: {
      id?: string;
      project_id: string;
      pm_user_id: string;
      interior_buildout_billed: number;
      interior_construction_billed: number;
      exterior_billed: number;
      notes: string;
      status: string;
      last_updated: string;
    }) => {
      if (sheet.id) {
        // Update existing draft
        const { data, error } = await supabase
          .from('pm_draw_sheets' as any)
          .update(sheet)
          .eq('id', sheet.id)
          .select()
          .single();
        if (error) throw error;
        return data as any;
      } else {
        // Insert new sheet
        const { data, error } = await supabase
          .from('pm_draw_sheets' as any)
          .insert(sheet)
          .select()
          .single();
        if (error) throw error;
        return data as any;
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pm_draw_sheet', vars.project_id, vars.pm_user_id] });
      qc.invalidateQueries({ queryKey: ['pm_draw_sheet_history', vars.project_id, vars.pm_user_id] });
    },
  });
}

export function useDrawPayments(drawSheetId?: string) {
  return useQuery({
    queryKey: ['pm_draw_payments', drawSheetId],
    enabled: !!drawSheetId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pm_draw_payments' as any)
        .select('*')
        .eq('draw_sheet_id', drawSheetId)
        .order('payment_date', { ascending: false });
      if (error) throw error;
      return (data as any[]) || [];
    },
  });
}

// Fetch ALL payments across all draw sheets for a project+PM
export function useAllDrawPayments(projectId?: string, pmUserId?: string) {
  return useQuery({
    queryKey: ['pm_draw_payments_all', projectId, pmUserId],
    enabled: !!projectId && !!pmUserId,
    queryFn: async () => {
      // First get all draw sheet IDs for this project+PM
      const { data: sheets, error: sheetsErr } = await supabase
        .from('pm_draw_sheets' as any)
        .select('id')
        .eq('project_id', projectId)
        .eq('pm_user_id', pmUserId);
      if (sheetsErr) throw sheetsErr;
      const sheetIds = (sheets as any[])?.map((s: any) => s.id) || [];
      if (sheetIds.length === 0) return [];
      const { data, error } = await supabase
        .from('pm_draw_payments' as any)
        .select('*')
        .in('draw_sheet_id', sheetIds)
        .order('payment_date', { ascending: false });
      if (error) throw error;
      return (data as any[]) || [];
    },
  });
}

export function useAddDrawPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payment: { draw_sheet_id: string; payment_date: string; amount: number; notes: string }) => {
      const { data, error } = await supabase
        .from('pm_draw_payments' as any)
        .insert(payment)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pm_draw_payments', vars.draw_sheet_id] });
    },
  });
}

export function useDeleteDrawPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, drawSheetId }: { id: string; drawSheetId: string }) => {
      const { error } = await supabase.from('pm_draw_payments' as any).delete().eq('id', id);
      if (error) throw error;
      return drawSheetId;
    },
    onSuccess: (drawSheetId) => {
      qc.invalidateQueries({ queryKey: ['pm_draw_payments', drawSheetId] });
    },
  });
}

export function useSubPayEntries(drawSheetId?: string) {
  return useQuery({
    queryKey: ['pm_sub_pay_entries', drawSheetId],
    enabled: !!drawSheetId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pm_sub_pay_entries' as any)
        .select('*')
        .eq('draw_sheet_id', drawSheetId)
        .order('created_at');
      if (error) throw error;
      return (data as any[]) || [];
    },
  });
}

export function useAddSubPayEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: { draw_sheet_id: string; sub_name: string; amount: number; description: string }) => {
      const { data, error } = await supabase
        .from('pm_sub_pay_entries' as any)
        .insert(entry)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pm_sub_pay_entries', vars.draw_sheet_id] });
    },
  });
}

export function useDeleteSubPayEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, drawSheetId }: { id: string; drawSheetId: string }) => {
      const { error } = await supabase.from('pm_sub_pay_entries' as any).delete().eq('id', id);
      if (error) throw error;
      return drawSheetId;
    },
    onSuccess: (drawSheetId) => {
      qc.invalidateQueries({ queryKey: ['pm_sub_pay_entries', drawSheetId] });
    },
  });
}

// Fetch all submitted draw sheets (for approvals page)
export function useSubmittedDrawSheets() {
  return useQuery({
    queryKey: ['pm_draw_sheets_all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pm_draw_sheets' as any)
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data as any[]) || [];
    },
  });
}

// Update draw sheet status (approve/reject)
export function useUpdateDrawSheetStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, rejectionNotes }: { id: string; status: string; rejectionNotes?: string }) => {
      const updates: Record<string, unknown> = { status };
      if (rejectionNotes !== undefined) updates.rejection_notes = rejectionNotes;
      const { error } = await supabase.from('pm_draw_sheets' as any).update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pm_draw_sheets_all'] });
      qc.invalidateQueries({ queryKey: ['pm_draw_sheet'] });
      qc.invalidateQueries({ queryKey: ['pm_draw_payments'] });
      qc.invalidateQueries({ queryKey: ['pm_draw_payments_all'] });
      qc.invalidateQueries({ queryKey: ['pm_draw_sheet_history'] });
    },
  });
}
