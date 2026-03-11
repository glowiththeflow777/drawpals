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
