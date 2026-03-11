import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import { Plus, Upload, Users, FileSpreadsheet, ChevronRight, ChevronDown, ArrowLeft, CheckCircle2, AlertCircle, Shield, UserCog, Loader2, Pencil, X, Save, Send, HardHat, MailCheck, Clock, RefreshCw } from 'lucide-react';
import ProjectDocuments from '@/components/ProjectDocuments';
import FinancialDashboard from '@/components/FinancialDashboard';
import SubcontractorBudgets from '@/components/SubcontractorBudgets';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import {
  useProjects, useBudgetLineItems, useTeamMembers, useProjectAssignments,
  useCreateProject, useUpdateProject, useInsertBudgetLineItems, useToggleAssignment,
  useAddAssignment, useUpdateAssignmentStatus, useRemoveAssignment,
  type DbProject, type DbBudgetLineItem, type DbTeamMember,
  type DbProject, type DbBudgetLineItem, type DbTeamMember,
} from '@/hooks/useProjects';
import type { Database } from '@/integrations/supabase/types';

type ProjectStatus = Database['public']['Enums']['project_status'];

// Parsed item type (local, before saving to DB)
interface ParsedLineItem {
  id: string;
  lineItemNo: number;
  costGroup: string;
  costItemName: string;
  description: string;
  quantity: number;
  unit: string;
  extendedCost: number;
  costType: string;
  costCode: string;
}

const ProjectPortal = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();

  const statusTabs: { value: ProjectStatus | 'all'; label: string }[] = [
    { value: 'active', label: t('projects.status.active') },
    { value: 'on-hold', label: t('projects.status.on-hold') },
    { value: 'completed', label: t('projects.status.completed') },
    { value: 'archived', label: t('projects.status.archived') },
    { value: 'all', label: t('projects.status.all') },
  ];

  // DB queries
  const { data: projects = [], isLoading: loadingProjects } = useProjects();
  const { data: allBudgetItems = [] } = useBudgetLineItems();
  const { data: teamMembers = [] } = useTeamMembers();
  const { data: allAssignments = [] } = useProjectAssignments();

  // Mutations
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const insertBudgetItems = useInsertBudgetLineItems();
  const toggleAssignment = useToggleAssignment();
  const addAssignment = useAddAssignment();
  const updateAssignmentStatus = useUpdateAssignmentStatus();
  const removeAssignment = useRemoveAssignment();

  const [activeTab, setActiveTab] = useState<ProjectStatus | 'all'>('active');
  const [view, setView] = useState<'list' | 'create' | 'detail'>('list');
  const [selectedProject, setSelectedProject] = useState<DbProject | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [parsedItems, setParsedItems] = useState<ParsedLineItem[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [showParsed, setShowParsed] = useState(false);
  const [creating, setCreating] = useState(false);

  // Edit project state
  const [editingProject, setEditingProject] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editBudget, setEditBudget] = useState('');

  // Create project form state
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newBudget, setNewBudget] = useState('');

  // Budget re-upload dialog state
  const [budgetUploadOpen, setBudgetUploadOpen] = useState(false);
  const [budgetParsedItems, setBudgetParsedItems] = useState<ParsedLineItem[]>([]);
  const [budgetSelectedIds, setBudgetSelectedIds] = useState<Set<string>>(new Set());
  const [budgetFileName, setBudgetFileName] = useState('');
  const [savingBudget, setSavingBudget] = useState(false);
  const [budgetExpanded, setBudgetExpanded] = useState(false);
  // Quick invite dialog state
  type QuickInviteRole = 'admin' | 'project-manager' | 'subcontractor';
  const [quickInviteOpen, setQuickInviteOpen] = useState(false);
  const [quickInviteRole, setQuickInviteRole] = useState<QuickInviteRole>('subcontractor');
  const [quickInviteForm, setQuickInviteForm] = useState({ name: '', email: '', phone: '', crew_name: '' });
  const [quickInviteSending, setQuickInviteSending] = useState(false);

  // Member detail dialog state
  const [memberDetailOpen, setMemberDetailOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<DbTeamMember | null>(null);
  const [resendingInvite, setResendingInvite] = useState(false);
  const [newAssignStatus, setNewAssignStatus] = useState<'invited' | 'pending' | 'active'>('invited');
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);

  const [currentUserId, setCurrentUserId] = useState('');
  const qc = useQueryClient();

  // Get current user id
  React.useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id);
    });
  }, []);

  const openQuickInvite = (role: QuickInviteRole) => {
    setQuickInviteRole(role);
    setQuickInviteForm({ name: '', email: '', phone: '', crew_name: '' });
    setQuickInviteOpen(true);
  };

  const handleQuickInvite = async () => {
    if (!quickInviteForm.name.trim() || !quickInviteForm.email.trim() || !selectedProject) return;
    setQuickInviteSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast({ title: t('team.sessionExpired'), description: t('team.sessionExpiredDesc'), variant: 'destructive' });
        navigate('/');
        return;
      }

      const res = await supabase.functions.invoke('invite-member', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: {
          email: quickInviteForm.email,
          name: quickInviteForm.name,
          role: quickInviteRole,
          phone: quickInviteForm.phone,
          crew_name: quickInviteRole === 'subcontractor' ? quickInviteForm.crew_name : null,
          project_id: selectedProject.id,
          redirect_url: `${window.location.origin}/reset-password`,
        },
      });

      if (res.error) throw new Error(res.error.message || 'Failed to send invitation');
      if (res.data?.error) throw new Error(res.data.error);

      toast({ title: t('team.inviteSent'), description: t('team.inviteDesc', { email: quickInviteForm.email }) });
      setQuickInviteOpen(false);
      // Refresh team members and assignments
      qc.invalidateQueries({ queryKey: ['team_members'] });
      qc.invalidateQueries({ queryKey: ['project_assignments'] });
    } catch (e: any) {
      toast({ title: t('common.error'), description: e.message, variant: 'destructive' });
    } finally {
      setQuickInviteSending(false);
    }
  };
  const filteredProjects = activeTab === 'all'
    ? projects
    : projects.filter(p => p.status === activeTab);

  // Get assignments for a project
  const getProjectAssignments = (projectId: string, role?: string) => {
    return allAssignments
      .filter((a: any) => a.project_id === projectId && (!role || a.team_members?.role === role))
      .map((a: any) => a.team_members as DbTeamMember)
      .filter(Boolean);
  };

  // Get assignment record (with status) for a specific member in a project
  const getAssignmentRecord = (projectId: string, teamMemberId: string) => {
    return allAssignments.find(
      (a: any) => a.project_id === projectId && a.team_member_id === teamMemberId
    ) as any | undefined;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'invited':
        return { label: 'Invited', className: 'bg-amber-500/10 text-amber-600', icon: MailCheck };
      case 'pending':
        return { label: 'Pending', className: 'bg-blue-500/10 text-blue-600', icon: Clock };
      case 'active':
      default:
        return { label: 'Active', className: 'status-badge-approved', icon: CheckCircle2 };
    }
  };

  const handleResendInvite = async () => {
    if (!selectedMember || !selectedProject) return;
    setResendingInvite(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast({ title: t('team.sessionExpired'), variant: 'destructive' });
        return;
      }

      const res = await supabase.functions.invoke('invite-member', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: {
          email: selectedMember.email,
          name: selectedMember.name,
          role: selectedMember.role,
          phone: selectedMember.phone,
          crew_name: selectedMember.crew_name,
          project_id: selectedProject.id,
          redirect_url: `${window.location.origin}/reset-password`,
        },
      });

      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);

      toast({ title: 'Invitation resent', description: `A new invitation was sent to ${selectedMember.email}` });
      qc.invalidateQueries({ queryKey: ['project_assignments'] });
    } catch (e: any) {
      toast({ title: t('common.error'), description: e.message, variant: 'destructive' });
    } finally {
      setResendingInvite(false);
    }
  };

  const parseBudgetFile = (file: File, onParsed: (items: ParsedLineItem[]) => void) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        if (rows.length === 0) { onParsed([]); return; }

        const headers = Object.keys(rows[0]);
        const fieldPatterns: [string, RegExp[]][] = [
          ['lineItemNo', [/^line\s*item\s*#?$/i, /^line\s*#?$/i, /^#$/i, /^no\.?$/i, /^number$/i]],
          ['costGroup',  [/^cost\s*group$/i, /^group$/i, /^division$/i, /^category$/i, /^csi$/i]],
          ['costItemName', [/^cost\s*item\s*name$/i, /^item\s*name$/i, /^name$/i, /^trade$/i]],
          ['description', [/^description$/i, /^desc\.?$/i, /^scope$/i, /^work$/i, /^scope\s*of\s*work$/i]],
          ['quantity', [/^quantity$/i, /^qty\.?$/i]],
          ['unit', [/^unit$/i, /^uom$/i, /^unit\s*of\s*measure$/i]],
          ['extendedCost', [/^extended\s*cost$/i, /^ext\.?\s*cost$/i, /^amount$/i, /^total$/i, /^cost$/i, /^price$/i]],
          ['costType', [/^cost\s*type$/i, /^type$/i]],
          ['costCode', [/^cost\s*code$/i, /^code$/i]],
        ];
        const colMap: Record<string, string> = {};
        const usedHeaders = new Set<string>();
        for (const [field, patterns] of fieldPatterns) {
          for (const pattern of patterns) {
            const matchIdx = headers.findIndex((h) => !usedHeaders.has(h) && pattern.test(h.trim()));
            if (matchIdx !== -1) { colMap[field] = headers[matchIdx]; usedHeaders.add(headers[matchIdx]); break; }
          }
        }
        const col = (field: string) => colMap[field] || '';
        const parsed: ParsedLineItem[] = rows.map((row, idx) => {
          const costRaw = String(row[col('extendedCost')] ?? '');
          const cost = parseFloat(costRaw.replace(/[^0-9.-]/g, '')) || 0;
          const lineNo = Number(row[col('lineItemNo')]);
          return {
            id: `parsed-${idx}`,
            lineItemNo: isNaN(lineNo) || lineNo === 0 ? idx + 1 : lineNo,
            costGroup: String(row[col('costGroup')] || ''),
            costItemName: String(row[col('costItemName')] || row[col('description')] || `Item ${idx + 1}`),
            description: String(row[col('description')] || ''),
            quantity: parseFloat(String(row[col('quantity')] ?? '').replace(/[^0-9.-]/g, '')) || 0,
            unit: String(row[col('unit')] || 'Each'),
            extendedCost: cost,
            costType: String(row[col('costType')] || 'Labor'),
            costCode: String(row[col('costCode')] || ''),
          };
        }).filter(item => item.costItemName || item.extendedCost > 0);
        onParsed(parsed);
      } catch (err) {
        console.error('Failed to parse file:', err);
        onParsed([]);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleBudgetReupload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBudgetFileName(file.name);
    parseBudgetFile(file, (items) => {
      setBudgetParsedItems(items);
      setBudgetSelectedIds(new Set(items.map(i => i.id)));
      setBudgetUploadOpen(true);
    });
    e.target.value = '';
  };

  const handleSaveBudgetItems = async () => {
    if (!selectedProject) return;
    const selected = budgetParsedItems.filter(i => budgetSelectedIds.has(i.id));
    if (selected.length === 0) return;
    setSavingBudget(true);
    try {
      const batchName = budgetFileName || `Budget ${new Date().toLocaleDateString()}`;
      await insertBudgetItems.mutateAsync(
        selected.map(item => ({
          project_id: selectedProject.id,
          line_item_no: item.lineItemNo,
          cost_group: item.costGroup,
          cost_item_name: item.costItemName,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          extended_cost: item.extendedCost,
          cost_type: item.costType,
          cost_code: item.costCode,
          batch_label: batchName,
        }))
      );

      // Update project total budget
      const currentItems = allBudgetItems.filter(b => b.project_id === selectedProject.id);
      const currentTotal = currentItems.reduce((s, i) => s + Number(i.extended_cost), 0);
      const newTotal = currentTotal + selected.reduce((s, i) => s + i.extendedCost, 0);
      await updateProject.mutateAsync({ id: selectedProject.id, total_budget: newTotal });
      setSelectedProject(prev => prev ? { ...prev, total_budget: newTotal } : prev);

      toast({ title: 'Budget items added', description: `${selected.length} line items added to the project.` });
      setBudgetUploadOpen(false);
      setBudgetParsedItems([]);
      setBudgetFileName('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to save budget items', variant: 'destructive' });
    } finally {
      setSavingBudget(false);
    }
  };

  const updateProjectStatus = async (projectId: string, status: ProjectStatus) => {
    try {
      await updateProject.mutateAsync({ id: projectId, status });
      setSelectedProject(prev => prev ? { ...prev, status } : prev);
    } catch {
      toast({ title: t('common.error'), description: 'Failed to update status', variant: 'destructive' });
    }
  };

  const handleToggleAssignment = async (projectId: string, teamMemberId: string) => {
    try {
      await toggleAssignment.mutateAsync({ projectId, teamMemberId });
    } catch {
      toast({ title: t('common.error'), description: 'Failed to update assignment', variant: 'destructive' });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        if (rows.length === 0) { setParsedItems([]); setShowParsed(true); return; }

        const headers = Object.keys(rows[0]);
        const fieldPatterns: [string, RegExp[]][] = [
          ['lineItemNo', [/^line\s*item\s*#?$/i, /^line\s*#?$/i, /^#$/i, /^no\.?$/i, /^number$/i]],
          ['costGroup',  [/^cost\s*group$/i, /^group$/i, /^division$/i, /^category$/i, /^csi$/i]],
          ['costItemName', [/^cost\s*item\s*name$/i, /^item\s*name$/i, /^name$/i, /^trade$/i]],
          ['description', [/^description$/i, /^desc\.?$/i, /^scope$/i, /^work$/i, /^scope\s*of\s*work$/i]],
          ['quantity', [/^quantity$/i, /^qty\.?$/i]],
          ['unit', [/^unit$/i, /^uom$/i, /^unit\s*of\s*measure$/i]],
          ['extendedCost', [/^extended\s*cost$/i, /^ext\.?\s*cost$/i, /^amount$/i, /^total$/i, /^cost$/i, /^price$/i]],
          ['costType', [/^cost\s*type$/i, /^type$/i]],
          ['costCode', [/^cost\s*code$/i, /^code$/i]],
        ];

        const colMap: Record<string, string> = {};
        const usedHeaders = new Set<string>();
        for (const [field, patterns] of fieldPatterns) {
          for (const pattern of patterns) {
            const matchIdx = headers.findIndex((h) => !usedHeaders.has(h) && pattern.test(h.trim()));
            if (matchIdx !== -1) { colMap[field] = headers[matchIdx]; usedHeaders.add(headers[matchIdx]); break; }
          }
        }
        const col = (field: string) => colMap[field] || '';

        const parsed: ParsedLineItem[] = rows.map((row, idx) => {
          const costRaw = String(row[col('extendedCost')] ?? '');
          const cost = parseFloat(costRaw.replace(/[^0-9.-]/g, '')) || 0;
          const lineNo = Number(row[col('lineItemNo')]);
          return {
            id: `parsed-${idx}`,
            lineItemNo: isNaN(lineNo) || lineNo === 0 ? idx + 1 : lineNo,
            costGroup: String(row[col('costGroup')] || ''),
            costItemName: String(row[col('costItemName')] || row[col('description')] || `Item ${idx + 1}`),
            description: String(row[col('description')] || ''),
            quantity: parseFloat(String(row[col('quantity')] ?? '').replace(/[^0-9.-]/g, '')) || 0,
            unit: String(row[col('unit')] || 'Each'),
            extendedCost: cost,
            costType: String(row[col('costType')] || 'Labor'),
            costCode: String(row[col('costCode')] || ''),
          };
        }).filter(item => item.costItemName || item.extendedCost > 0);

        setParsedItems(parsed);
        setSelectedItemIds(new Set(parsed.map(i => i.id)));
        setShowParsed(true);
      } catch (err) {
        console.error('Failed to parse file:', err);
        setParsedItems([]); setShowParsed(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const selectedParsedItems = parsedItems.filter(i => selectedItemIds.has(i.id));

  const toggleItem = (id: string) => {
    setSelectedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedItemIds.size === parsedItems.length) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(parsedItems.map(i => i.id)));
    }
  };

  const handleCreateProject = async () => {
    if (!newName || !newAddress) return;
    setCreating(true);
    try {
      const budgetTotal = selectedParsedItems.length > 0
        ? selectedParsedItems.reduce((s, i) => s + i.extendedCost, 0)
        : Number(newBudget) || 0;

      const newProject = await createProject.mutateAsync({
        name: newName,
        address: newAddress,
        total_budget: budgetTotal,
      });

      if (selectedParsedItems.length > 0) {
        const batchName = uploadedFileName || `Budget ${new Date().toLocaleDateString()}`;
        await insertBudgetItems.mutateAsync(
          selectedParsedItems.map(item => ({
            project_id: newProject.id,
            line_item_no: item.lineItemNo,
            cost_group: item.costGroup,
            cost_item_name: item.costItemName,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            extended_cost: item.extendedCost,
            cost_type: item.costType,
            cost_code: item.costCode,
            batch_label: batchName,
          }))
        );
      }

      toast({ title: 'Project created!', description: `${newProject.name} has been saved.` });

      // Reset form
      setNewName(''); setNewAddress(''); setNewBudget('');
      setParsedItems([]); setShowParsed(false); setUploadedFileName('');
      setView('list');
    } catch {
      toast({ title: 'Error', description: 'Failed to create project', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <main className="max-w-6xl mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          {/* ===== PROJECT LIST ===== */}
          {view === 'list' && (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-display font-bold">{t('projects.title')}</h2>
                <Button onClick={() => setView('create')} className="gradient-primary text-primary-foreground font-display">
                  <Plus className="w-4 h-4 mr-2" /> {t('projects.newProject')}
                </Button>
              </div>

              {loadingProjects ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ProjectStatus | 'all')} className="w-full">
                  <TabsList className="w-full justify-start overflow-x-auto">
                    {statusTabs.map(tab => (
                      <TabsTrigger key={tab.value} value={tab.value} className="font-display capitalize">
                        {tab.label}
                        <span className="ml-2 text-xs bg-muted rounded-full px-1.5 py-0.5">
                          {tab.value === 'all' ? projects.length : projects.filter(p => p.status === tab.value).length}
                        </span>
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  <TabsContent value={activeTab} className="mt-4">
                    {filteredProjects.length === 0 ? (
                      <div className="card-elevated p-8 text-center">
                        <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-muted-foreground font-body">No {activeTab === 'all' ? '' : activeTab} projects found.</p>
                      </div>
                    ) : (
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {filteredProjects.map(project => {
                          const projectBudgetItems = allBudgetItems.filter(b => b.project_id === project.id);
                          const assignedAdmins = getProjectAssignments(project.id, 'admin');
                          const assignedPMs = getProjectAssignments(project.id, 'project-manager');
                          const assignedSubs = getProjectAssignments(project.id, 'subcontractor');
                          const statusBadgeClass = {
                            active: 'status-badge-approved',
                            'on-hold': 'bg-amber-500/10 text-amber-600',
                            completed: 'status-badge-pending',
                            archived: 'bg-muted text-muted-foreground',
                          }[project.status];
                          return (
                            <motion.div
                              key={project.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="card-elevated p-5 cursor-pointer hover:shadow-lg transition-shadow"
                              onClick={() => { setSelectedProject(project); setView('detail'); }}
                            >
                              <div className="flex items-start justify-between mb-3">
                                <div>
                                  <h3 className="font-display font-semibold text-lg">{project.name}</h3>
                                  <p className="text-xs text-muted-foreground font-body">{project.address}</p>
                                </div>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${statusBadgeClass}`}>
                                  {project.status}
                                </span>
                              </div>

                              <div className="space-y-2 mb-4">
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground font-body">Budget</span>
                                  <span className="font-display font-semibold">${Number(project.total_budget).toLocaleString()}</span>
                                </div>
                                <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-primary transition-all"
                                    style={{ width: `${Math.min(100, (Number(project.amount_invoiced) / Number(project.total_budget)) * 100 || 0)}%` }}
                                  />
                                </div>
                                <div className="flex justify-between text-xs text-muted-foreground">
                                  <span>${Number(project.amount_invoiced).toLocaleString()} invoiced</span>
                                  <span>${(Number(project.total_budget) - Number(project.amount_invoiced)).toLocaleString()} remaining</span>
                                </div>
                              </div>

                              {/* Assigned Managers Preview */}
                              {(assignedAdmins.length > 0 || assignedPMs.length > 0) && (
                                <div className="flex flex-wrap gap-1 mb-3">
                                  {assignedAdmins.slice(0, 2).map(m => (
                                    <span key={m.id} className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                      <Shield className="w-3 h-3" /> {m.name.split(' ')[0]}
                                    </span>
                                  ))}
                                  {assignedPMs.slice(0, 2).map(m => (
                                    <span key={m.id} className="inline-flex items-center gap-1 text-xs bg-accent/50 text-accent-foreground px-2 py-0.5 rounded-full">
                                      <UserCog className="w-3 h-3" /> {m.name.split(' ')[0]}
                                    </span>
                                  ))}
                                </div>
                              )}

                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <FileSpreadsheet className="w-3 h-3" />
                                  <span>{projectBudgetItems.length} line items</span>
                                </div>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Users className="w-3 h-3" />
                                  <span>{assignedSubs.length} subs</span>
                                </div>
                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              )}
            </motion.div>
          )}

          {/* ===== CREATE PROJECT ===== */}
          {view === 'create' && (
            <motion.div key="create" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6 max-w-2xl">
              <button onClick={() => { setView('list'); setParsedItems([]); setShowParsed(false); setUploadedFileName(''); }} className="text-muted-foreground text-sm hover:text-foreground transition-colors flex items-center gap-1">
                <ArrowLeft className="w-4 h-4" /> Back to Projects
              </button>

              <h2 className="text-2xl font-display font-bold">Create New Project</h2>

              <div className="card-elevated p-6 space-y-5">
                <div>
                  <Label htmlFor="project-name" className="font-display font-semibold">Project Name</Label>
                  <Input id="project-name" placeholder="e.g. Beckett Dr. Build-Out" className="mt-1" value={newName} onChange={e => setNewName(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="project-address" className="font-display font-semibold">Project Address</Label>
                  <Input id="project-address" placeholder="e.g. 7008 Beckett Dr., Austin TX" className="mt-1" value={newAddress} onChange={e => setNewAddress(e.target.value)} />
                </div>

                {/* Budget Upload */}
                <div className="space-y-3">
                  <Label className="font-display font-semibold">Upload Budget (Excel/CSV)</Label>
                  <p className="text-xs text-muted-foreground">Upload your project budget spreadsheet and we'll automatically parse it into line items.</p>
                  <div className="relative">
                    <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                    <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors">
                      <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="font-body text-sm text-muted-foreground">
                        {uploadedFileName ? <span className="text-foreground font-medium">{uploadedFileName}</span> : 'Drag & drop or tap to upload'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">.xlsx, .xls, or .csv</p>
                    </div>
                  </div>
                </div>

                {/* Parsed Budget Items Preview */}
                {showParsed && parsedItems.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-success" />
                        <p className="text-sm font-display font-semibold">{selectedItemIds.size} of {parsedItems.length} line items selected</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={toggleAll} className="text-xs">
                        {selectedItemIds.size === parsedItems.length ? 'Deselect All' : 'Select All'}
                      </Button>
                    </div>
                    <div className="border border-border rounded-lg overflow-hidden">
                      <div className="overflow-x-auto max-h-64 overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 bg-muted">
                            <tr>
                              <th className="p-2 w-8"><Checkbox checked={selectedItemIds.size === parsedItems.length} onCheckedChange={toggleAll} /></th>
                              <th className="text-left p-2 text-xs font-display">#</th>
                              <th className="text-left p-2 text-xs font-display">Item</th>
                              <th className="text-left p-2 text-xs font-display">Group</th>
                              <th className="text-right p-2 text-xs font-display">Cost</th>
                              <th className="text-left p-2 text-xs font-display">Type</th>
                            </tr>
                          </thead>
                          <tbody>
                            {parsedItems.map(item => {
                              const isSelected = selectedItemIds.has(item.id);
                              return (
                                <tr key={item.id} className={`border-t border-border/50 cursor-pointer transition-colors ${isSelected ? '' : 'opacity-40'}`} onClick={() => toggleItem(item.id)}>
                                  <td className="p-2" onClick={e => e.stopPropagation()}><Checkbox checked={isSelected} onCheckedChange={() => toggleItem(item.id)} /></td>
                                  <td className="p-2 text-muted-foreground">{item.lineItemNo}</td>
                                  <td className="p-2 font-body">{item.costItemName}</td>
                                  <td className="p-2 text-muted-foreground text-xs">{item.costGroup}</td>
                                  <td className="p-2 text-right font-display font-semibold">${item.extendedCost.toLocaleString()}</td>
                                  <td className="p-2"><span className="px-1.5 py-0.5 rounded text-xs bg-muted text-muted-foreground">{item.costType}</span></td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <div className="border-t border-border p-3 bg-muted/50 flex justify-between items-center">
                        <span className="text-sm text-muted-foreground font-body">Selected Total</span>
                        <span className="font-display font-bold text-lg">${selectedParsedItems.reduce((s, i) => s + i.extendedCost, 0).toLocaleString()}</span>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Manual budget entry fallback */}
                {!showParsed && (
                  <div>
                    <Label htmlFor="manual-budget" className="font-display font-semibold">Or Enter Total Budget Manually</Label>
                    <Input id="manual-budget" type="number" placeholder="e.g. 45000" className="mt-1" value={newBudget} onChange={e => setNewBudget(e.target.value)} />
                  </div>
                )}

                <Button onClick={handleCreateProject} disabled={!newName || !newAddress || creating} className="w-full gradient-primary text-primary-foreground py-5 text-lg font-display rounded-xl">
                  {creating ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Creating...</> : 'Create Project'}
                </Button>
              </div>
            </motion.div>
          )}

          {/* ===== PROJECT DETAIL ===== */}
          {view === 'detail' && selectedProject && (
            <motion.div key="detail" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
              <button onClick={() => { setView('list'); setSelectedProject(null); }} className="text-muted-foreground text-sm hover:text-foreground transition-colors flex items-center gap-1">
                <ArrowLeft className="w-4 h-4" /> Back to Projects
              </button>

              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                {editingProject ? (
                  <div className="space-y-2 flex-1">
                    <Input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="text-2xl font-display font-bold h-auto py-1"
                      placeholder="Project Name"
                    />
                    <Input
                      value={editAddress}
                      onChange={e => setEditAddress(e.target.value)}
                      className="text-sm h-auto py-1"
                      placeholder="Project Address"
                    />
                    <div className="flex items-center gap-2">
                      <Label className="text-sm font-display whitespace-nowrap">Total Budget $</Label>
                      <Input
                        type="number"
                        value={editBudget}
                        onChange={e => setEditBudget(e.target.value)}
                        className="w-40 h-auto py-1"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <h2 className="text-2xl font-display font-bold">{selectedProject.name}</h2>
                    <p className="text-muted-foreground font-body">{selectedProject.address}</p>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  {editingProject ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingProject(false)}
                      >
                        <X className="w-4 h-4 mr-1" /> Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="gradient-primary text-primary-foreground"
                        disabled={updateProject.isPending}
                        onClick={async () => {
                          try {
                            await updateProject.mutateAsync({
                              id: selectedProject.id,
                              name: editName,
                              address: editAddress,
                              total_budget: Number(editBudget) || 0,
                            });
                            setSelectedProject(prev => prev ? {
                              ...prev,
                              name: editName,
                              address: editAddress,
                              total_budget: Number(editBudget) || 0,
                            } : prev);
                            setEditingProject(false);
                            toast({ title: 'Project updated' });
                          } catch {
                            toast({ title: 'Error', description: 'Failed to update project', variant: 'destructive' });
                          }
                        }}
                      >
                        {updateProject.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                        Save
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditName(selectedProject.name);
                          setEditAddress(selectedProject.address);
                          setEditBudget(String(selectedProject.total_budget));
                          setEditingProject(true);
                        }}
                      >
                        <Pencil className="w-4 h-4 mr-1" /> Edit
                      </Button>
                      <Select value={selectedProject.status} onValueChange={(v) => updateProjectStatus(selectedProject.id, v as ProjectStatus)}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="on-hold">On Hold</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="archived">Archived</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button onClick={() => navigate(`/invoice/new?project=${selectedProject.id}&admin=true`)} className="gradient-primary text-primary-foreground font-display">
                        <Plus className="w-4 h-4 mr-1" /> Submit Invoice for Sub
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Financial Dashboard */}
              <FinancialDashboard
                projectId={selectedProject.id}
                project={selectedProject}
              />

              {/* Assigned Admins & Project Managers */}
              <div className="card-elevated p-5 space-y-5">
                <h3 className="font-display font-semibold text-lg flex items-center gap-2">
                  <Shield className="w-5 h-5 text-muted-foreground" />
                  Team Assignment
                </h3>

                {/* Admins */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-primary" />
                      <Label className="font-display font-semibold text-sm">{t('team.roles.admin')}</Label>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => openQuickInvite('admin')} className="text-xs font-display">
                      <Plus className="w-3 h-3 mr-1" /> {t('projects.detail.inviteAndAdd')}
                    </Button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {teamMembers.filter(m => m.role === 'admin').map(member => {
                      const isAssigned = getProjectAssignments(selectedProject.id, 'admin').some(a => a.id === member.id);
                      const assignment = getAssignmentRecord(selectedProject.id, member.id);
                      const status = assignment?.invitation_status || 'active';
                      const badge = getStatusBadge(status);
                      return (
                        <button
                          key={member.id}
                          onClick={() => {
                            setSelectedMember(member);
                            if (!isAssigned) setNewAssignStatus('invited');
                            setMemberDetailOpen(true);
                          }}
                          className={`flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                            isAssigned ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/30'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-display font-bold ${
                            isAssigned ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                          }`}>
                            {member.name[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-display font-medium text-sm truncate">{member.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                          </div>
                          {isAssigned && (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 ${badge.className}`}>
                              <badge.icon className="w-3 h-3" />
                              {badge.label}
                            </span>
                          )}
                        </button>
                      );
                    })}
                    {teamMembers.filter(m => m.role === 'admin').length === 0 && (
                      <p className="text-sm text-muted-foreground col-span-2">{t('projects.detail.noAdmins')}</p>
                    )}
                  </div>
                </div>

                {/* Project Managers */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <UserCog className="w-4 h-4 text-accent-foreground" />
                      <Label className="font-display font-semibold text-sm">{t('team.roles.project-manager')}</Label>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => openQuickInvite('project-manager')} className="text-xs font-display">
                      <Plus className="w-3 h-3 mr-1" /> {t('projects.detail.inviteAndAdd')}
                    </Button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {teamMembers.filter(m => m.role === 'project-manager').map(member => {
                      const isAssigned = getProjectAssignments(selectedProject.id, 'project-manager').some(a => a.id === member.id);
                      const assignment = getAssignmentRecord(selectedProject.id, member.id);
                      const status = assignment?.invitation_status || 'active';
                      const badge = getStatusBadge(status);
                      return (
                        <button
                          key={member.id}
                          onClick={() => {
                            setSelectedMember(member);
                            if (!isAssigned) setNewAssignStatus('invited');
                            setMemberDetailOpen(true);
                          }}
                          className={`flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                            isAssigned ? 'border-accent bg-accent/10' : 'border-border hover:border-muted-foreground/30'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-display font-bold ${
                            isAssigned ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'
                          }`}>
                            {member.name[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-display font-medium text-sm truncate">{member.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                          </div>
                          {isAssigned && (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 ${badge.className}`}>
                              <badge.icon className="w-3 h-3" />
                              {badge.label}
                            </span>
                          )}
                        </button>
                      );
                    })}
                    {teamMembers.filter(m => m.role === 'project-manager').length === 0 && (
                      <p className="text-sm text-muted-foreground col-span-2">{t('projects.detail.noPMs')}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Assigned Subcontractors */}
              <div className="card-elevated p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-semibold text-lg flex items-center gap-2">
                    <Users className="w-5 h-5 text-muted-foreground" />
                    {t('projects.detail.assignedSubs')}
                  </h3>
                  <Button variant="outline" size="sm" onClick={() => openQuickInvite('subcontractor')} className="text-xs font-display">
                    <Plus className="w-3 h-3 mr-1" /> {t('projects.detail.inviteAndAdd')}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground font-body">
                  {t('projects.detail.toggleSubsDesc')}
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {teamMembers.filter(m => m.role === 'subcontractor').map(sub => {
                    const isAssigned = getProjectAssignments(selectedProject.id, 'subcontractor').some(a => a.id === sub.id);
                    const assignment = getAssignmentRecord(selectedProject.id, sub.id);
                    const status = assignment?.invitation_status || 'active';
                    const badge = getStatusBadge(status);
                    return (
                      <button
                        key={sub.id}
                        onClick={() => {
                          setSelectedMember(sub);
                          if (!isAssigned) setNewAssignStatus('invited');
                          setMemberDetailOpen(true);
                        }}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                          isAssigned ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/30'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-display font-bold ${
                          isAssigned ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                        }`}>
                          {sub.crew_name?.[0] || sub.name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-display font-medium text-sm truncate">{sub.crew_name || sub.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{sub.email}</p>
                        </div>
                        {isAssigned && (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 ${badge.className}`}>
                            <badge.icon className="w-3 h-3" />
                            {badge.label}
                          </span>
                        )}
                      </button>
                    );
                  })}
                  {teamMembers.filter(m => m.role === 'subcontractor').length === 0 && (
                    <p className="text-sm text-muted-foreground col-span-2">{t('projects.detail.noSubs')}</p>
                  )}
                </div>
              </div>

              {/* Subcontractor Budgets */}
              <SubcontractorBudgets
                projectId={selectedProject.id}
                assignedSubs={getProjectAssignments(selectedProject.id, 'subcontractor')}
                currentUserId={currentUserId}
              />

              {/* Budget Line Items (Master - Admin Only) */}
              <div className="card-elevated p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setBudgetExpanded(!budgetExpanded)}
                    className="flex items-center gap-2 font-display font-semibold text-lg hover:text-primary transition-colors"
                  >
                    {budgetExpanded ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
                    <FileSpreadsheet className="w-5 h-5 text-muted-foreground" />
                    Budget Line Items
                    <span className="text-sm font-normal text-muted-foreground">
                      ({allBudgetItems.filter(b => b.project_id === selectedProject.id).length} items)
                    </span>
                  </button>
                  {budgetExpanded && (
                    <div className="relative">
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={handleBudgetReupload}
                        className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full"
                      />
                      <Button variant="outline" size="sm" className="font-display text-xs">
                        <Upload className="w-3 h-3 mr-1" /> Add Budget Items
                      </Button>
                    </div>
                  )}
                </div>
                {budgetExpanded && (() => {
                  const items = allBudgetItems.filter(b => b.project_id === selectedProject.id);
                  if (items.length === 0) {
                    return (
                      <div className="text-center py-8">
                        <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-muted-foreground font-body">No budget items yet. Upload a budget spreadsheet to get started.</p>
                      </div>
                    );
                  }

                  // Group items by batch_label
                  const batches = new Map<string, typeof items>();
                  items.forEach(item => {
                    const label = (item as any).batch_label || 'Original Budget';
                    if (!batches.has(label)) batches.set(label, []);
                    batches.get(label)!.push(item);
                  });

                  const grandTotal = items.reduce((s, i) => s + Number(i.extended_cost), 0);

                  const renderBatchTable = (batchItems: typeof items) => (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left p-3 font-display font-semibold text-muted-foreground text-xs">#</th>
                            <th className="text-left p-3 font-display font-semibold text-muted-foreground text-xs">Item</th>
                            <th className="text-left p-3 font-display font-semibold text-muted-foreground text-xs">Description</th>
                            <th className="text-right p-3 font-display font-semibold text-muted-foreground text-xs">Qty</th>
                            <th className="text-left p-3 font-display font-semibold text-muted-foreground text-xs">Unit</th>
                            <th className="text-right p-3 font-display font-semibold text-muted-foreground text-xs">Cost</th>
                            <th className="text-left p-3 font-display font-semibold text-muted-foreground text-xs">Type</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            let lastGroup = '';
                            return batchItems.map(item => {
                              const showGroupHeader = item.cost_group && item.cost_group !== lastGroup;
                              if (item.cost_group) lastGroup = item.cost_group;
                              return (
                                <React.Fragment key={item.id}>
                                  {showGroupHeader && (
                                    <tr className="bg-muted/50">
                                      <td colSpan={7} className="p-3 font-display font-bold text-sm text-foreground">
                                        {item.cost_group}
                                      </td>
                                    </tr>
                                  )}
                                  <tr className="border-b border-border/50 hover:bg-muted/30">
                                    <td className="p-3">{item.line_item_no}</td>
                                    <td className="p-3 font-body font-medium">{item.cost_item_name}</td>
                                    <td className="p-3 text-muted-foreground text-xs max-w-[200px] truncate">{item.description}</td>
                                    <td className="p-3 text-right">{Number(item.quantity).toLocaleString()}</td>
                                    <td className="p-3 text-muted-foreground text-xs">{item.unit}</td>
                                    <td className="p-3 text-right font-display font-semibold">${Number(item.extended_cost).toLocaleString()}</td>
                                    <td className="p-3"><span className="px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground">{item.cost_type}</span></td>
                                  </tr>
                                </React.Fragment>
                              );
                            });
                          })()}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-border">
                            <td colSpan={5} className="p-3 text-right font-display font-semibold text-sm">Subtotal</td>
                            <td className="p-3 text-right font-display font-bold">${batchItems.reduce((s, i) => s + Number(i.extended_cost), 0).toLocaleString()}</td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  );

                  return (
                    <div className="space-y-4">
                      {Array.from(batches.entries()).map(([label, batchItems], idx) => (
                        <div key={label} className="border border-border rounded-lg overflow-hidden">
                          <div className="bg-muted/30 px-4 py-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <FileSpreadsheet className="w-4 h-4 text-muted-foreground" />
                              <span className="font-display font-semibold text-sm">{label}</span>
                              <span className="text-xs text-muted-foreground">({batchItems.length} items)</span>
                            </div>
                            <span className="font-display font-bold text-sm">
                              ${batchItems.reduce((s, i) => s + Number(i.extended_cost), 0).toLocaleString()}
                            </span>
                          </div>
                          {renderBatchTable(batchItems)}
                        </div>
                      ))}

                      {/* Grand Total across all batches */}
                      {batches.size > 1 && (
                        <div className="flex items-center justify-between p-4 bg-primary/5 border-2 border-primary/20 rounded-lg">
                          <span className="font-display font-bold text-lg">Combined Total ({items.length} items)</span>
                          <span className="font-display font-bold text-xl">${grandTotal.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Documents */}
              <ProjectDocuments projectId={selectedProject.id} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Quick Invite Dialog */}
      <Dialog open={quickInviteOpen} onOpenChange={setQuickInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">
              {t('projects.detail.inviteTitle', { role: quickInviteRole === 'admin' ? t('team.roles.admin') : quickInviteRole === 'project-manager' ? t('team.roles.project-manager') : t('team.roles.subcontractor') })}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground font-body">{t('projects.detail.inviteDesc')}</p>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium font-body mb-1.5 block">{t('common.name')} *</label>
              <Input value={quickInviteForm.name} onChange={e => setQuickInviteForm(f => ({ ...f, name: e.target.value }))} placeholder={t('team.namePlaceholder')} />
            </div>
            <div>
              <label className="text-sm font-medium font-body mb-1.5 block">{t('common.email')} *</label>
              <Input type="email" value={quickInviteForm.email} onChange={e => setQuickInviteForm(f => ({ ...f, email: e.target.value }))} placeholder={t('team.emailPlaceholder')} />
            </div>
            <div>
              <label className="text-sm font-medium font-body mb-1.5 block">{t('common.phone')}</label>
              <Input value={quickInviteForm.phone} onChange={e => setQuickInviteForm(f => ({ ...f, phone: e.target.value }))} placeholder={t('team.phonePlaceholder')} />
            </div>
            {quickInviteRole === 'subcontractor' && (
              <div>
                <label className="text-sm font-medium font-body mb-1.5 block">{t('team.crewName')}</label>
                <Input value={quickInviteForm.crew_name} onChange={e => setQuickInviteForm(f => ({ ...f, crew_name: e.target.value }))} placeholder={t('team.crewPlaceholder')} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickInviteOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleQuickInvite} disabled={quickInviteSending || !quickInviteForm.name.trim() || !quickInviteForm.email.trim()}>
              {quickInviteSending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
              {t('projects.detail.inviteSendBtn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Member Detail Dialog */}
      <Dialog open={memberDetailOpen} onOpenChange={(open) => { setMemberDetailOpen(open); if (!open) setConfirmRemoveOpen(false); }}>
        <DialogContent className="sm:max-w-md">
          {selectedMember && selectedProject && (() => {
            const assignment = getAssignmentRecord(selectedProject.id, selectedMember.id);
            const isAssigned = !!assignment;
            const status = assignment?.invitation_status || 'active';
            const badge = getStatusBadge(status);
            const invitedAt = assignment?.invited_at ? new Date(assignment.invited_at).toLocaleDateString() : null;
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="font-display">{isAssigned ? 'Team Member Details' : 'Add to Project'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-display font-bold text-lg">
                      {selectedMember.crew_name?.[0] || selectedMember.name[0]}
                    </div>
                    <div className="flex-1">
                      <p className="font-display font-semibold text-lg">{selectedMember.name}</p>
                      {selectedMember.crew_name && (
                        <p className="text-sm text-muted-foreground">{selectedMember.crew_name}</p>
                      )}
                    </div>
                    {isAssigned && (
                      <span className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1.5 ${badge.className}`}>
                        <badge.icon className="w-4 h-4" />
                        {badge.label}
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 bg-muted/50 rounded-lg p-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Email</span>
                      <span className="font-medium">{selectedMember.email}</span>
                    </div>
                    {selectedMember.phone && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Phone</span>
                        <span className="font-medium">{selectedMember.phone}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Role</span>
                      <span className="font-medium capitalize">{selectedMember.role}</span>
                    </div>
                    {invitedAt && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Last Invited</span>
                        <span className="font-medium">{invitedAt}</span>
                      </div>
                    )}
                  </div>

                  {/* Status Selector for assigned members */}
                  {isAssigned && (
                    <div className="space-y-2">
                      <Label className="font-display font-semibold text-sm">Assignment Status</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['invited', 'pending', 'active'] as const).map(s => {
                          const b = getStatusBadge(s);
                          const isCurrent = status === s;
                          return (
                            <button
                              key={s}
                              onClick={async () => {
                                if (isCurrent) return;
                                try {
                                  await updateAssignmentStatus.mutateAsync({ assignmentId: assignment.id, status: s });
                                  toast({ title: 'Status updated', description: `${selectedMember.name} is now "${s}".` });
                                } catch {
                                  toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' });
                                }
                              }}
                              className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all ${
                                isCurrent
                                  ? 'border-primary bg-primary/5'
                                  : 'border-border hover:border-muted-foreground/40'
                              }`}
                            >
                              <b.icon className={`w-5 h-5 ${isCurrent ? 'text-primary' : 'text-muted-foreground'}`} />
                              <span className={`text-xs font-display font-medium capitalize ${isCurrent ? 'text-foreground' : 'text-muted-foreground'}`}>
                                {b.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Status picker for NEW assignment */}
                  {!isAssigned && (
                    <div className="space-y-2">
                      <Label className="font-display font-semibold text-sm">Assign with Status</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['invited', 'pending', 'active'] as const).map(s => {
                          const b = getStatusBadge(s);
                          const isCurrent = newAssignStatus === s;
                          return (
                            <button
                              key={s}
                              onClick={() => setNewAssignStatus(s)}
                              className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all ${
                                isCurrent
                                  ? 'border-primary bg-primary/5'
                                  : 'border-border hover:border-muted-foreground/40'
                              }`}
                            >
                              <b.icon className={`w-5 h-5 ${isCurrent ? 'text-primary' : 'text-muted-foreground'}`} />
                              <span className={`text-xs font-display font-medium capitalize ${isCurrent ? 'text-foreground' : 'text-muted-foreground'}`}>
                                {b.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {status !== 'active' && isAssigned && (
                    <div className="p-3 rounded-lg bg-muted border border-border">
                      <p className="text-sm text-muted-foreground font-body">
                        This member hasn't fully activated yet. You can resend the invitation email.
                      </p>
                    </div>
                  )}
                </div>
                <DialogFooter className="flex gap-2 sm:gap-2">
                  {isAssigned ? (
                    <>
                      {!confirmRemoveOpen ? (
                        <Button variant="outline" onClick={() => setConfirmRemoveOpen(true)} className="text-destructive hover:text-destructive">
                          <X className="w-4 h-4 mr-1" />
                          Remove from Project
                        </Button>
                      ) : (
                        <div className="flex items-center gap-2 w-full">
                          <p className="text-sm text-destructive font-body flex-1">Are you sure?</p>
                          <Button variant="outline" size="sm" onClick={() => setConfirmRemoveOpen(false)}>Cancel</Button>
                          <Button variant="destructive" size="sm" onClick={async () => {
                            try {
                              await removeAssignment.mutateAsync({ assignmentId: assignment.id });
                              toast({ title: 'Removed', description: `${selectedMember.name} removed from project.` });
                              setMemberDetailOpen(false);
                              setConfirmRemoveOpen(false);
                            } catch {
                              toast({ title: 'Error', description: 'Failed to remove', variant: 'destructive' });
                            }
                          }}>
                            Confirm Remove
                          </Button>
                        </div>
                      )}
                      {!confirmRemoveOpen && status !== 'active' && (
                        <Button onClick={handleResendInvite} disabled={resendingInvite}>
                          {resendingInvite ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
                          Resend Invitation
                        </Button>
                      )}
                      {!confirmRemoveOpen && status === 'active' && (
                        <Button variant="outline" onClick={() => setMemberDetailOpen(false)}>
                          Close
                        </Button>
                      )}
                    </>
                  ) : (
                    <>
                      <Button variant="outline" onClick={() => setMemberDetailOpen(false)}>Cancel</Button>
                      <Button
                        className="gradient-primary text-primary-foreground"
                        onClick={async () => {
                          try {
                            await addAssignment.mutateAsync({
                              projectId: selectedProject.id,
                              teamMemberId: selectedMember.id,
                              status: newAssignStatus,
                            });
                            toast({ title: 'Assigned', description: `${selectedMember.name} added as "${newAssignStatus}".` });
                            setMemberDetailOpen(false);
                          } catch {
                            toast({ title: 'Error', description: 'Failed to assign', variant: 'destructive' });
                          }
                        }}
                        disabled={addAssignment.isPending}
                      >
                        {addAssignment.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
                        Add to Project
                      </Button>
                    </>
                  )}
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Budget Upload Preview Dialog */}
      <Dialog open={budgetUploadOpen} onOpenChange={setBudgetUploadOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Add Budget Line Items</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground font-body">
            Parsed <strong>{budgetParsedItems.length}</strong> items from <strong>{budgetFileName}</strong>. Select the items to add to this project.
          </p>

          {budgetParsedItems.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  <p className="text-sm font-display font-semibold">{budgetSelectedIds.size} of {budgetParsedItems.length} selected</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (budgetSelectedIds.size === budgetParsedItems.length) {
                      setBudgetSelectedIds(new Set());
                    } else {
                      setBudgetSelectedIds(new Set(budgetParsedItems.map(i => i.id)));
                    }
                  }}
                  className="text-xs"
                >
                  {budgetSelectedIds.size === budgetParsedItems.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="overflow-x-auto max-h-64 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted">
                      <tr>
                        <th className="p-2 w-8">
                          <Checkbox
                            checked={budgetSelectedIds.size === budgetParsedItems.length}
                            onCheckedChange={() => {
                              if (budgetSelectedIds.size === budgetParsedItems.length) {
                                setBudgetSelectedIds(new Set());
                              } else {
                                setBudgetSelectedIds(new Set(budgetParsedItems.map(i => i.id)));
                              }
                            }}
                          />
                        </th>
                        <th className="text-left p-2 text-xs font-display">#</th>
                        <th className="text-left p-2 text-xs font-display">Item</th>
                        <th className="text-left p-2 text-xs font-display">Group</th>
                        <th className="text-right p-2 text-xs font-display">Cost</th>
                        <th className="text-left p-2 text-xs font-display">Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {budgetParsedItems.map(item => {
                        const isSelected = budgetSelectedIds.has(item.id);
                        return (
                          <tr
                            key={item.id}
                            className={`border-t border-border/50 cursor-pointer transition-colors ${isSelected ? '' : 'opacity-40'}`}
                            onClick={() => {
                              setBudgetSelectedIds(prev => {
                                const next = new Set(prev);
                                if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
                                return next;
                              });
                            }}
                          >
                            <td className="p-2" onClick={e => e.stopPropagation()}>
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => {
                                  setBudgetSelectedIds(prev => {
                                    const next = new Set(prev);
                                    if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
                                    return next;
                                  });
                                }}
                              />
                            </td>
                            <td className="p-2 text-muted-foreground">{item.lineItemNo}</td>
                            <td className="p-2 font-body">{item.costItemName}</td>
                            <td className="p-2 text-muted-foreground text-xs">{item.costGroup}</td>
                            <td className="p-2 text-right font-display font-semibold">${item.extendedCost.toLocaleString()}</td>
                            <td className="p-2"><span className="px-1.5 py-0.5 rounded text-xs bg-muted text-muted-foreground">{item.costType}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="border-t border-border p-3 bg-muted/50 flex justify-between items-center">
                  <span className="text-sm text-muted-foreground font-body">Selected Total</span>
                  <span className="font-display font-bold text-lg">
                    ${budgetParsedItems.filter(i => budgetSelectedIds.has(i.id)).reduce((s, i) => s + i.extendedCost, 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          {budgetParsedItems.length === 0 && (
            <div className="text-center py-8">
              <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground font-body text-sm">No items could be parsed from this file.</p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setBudgetUploadOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSaveBudgetItems}
              disabled={savingBudget || budgetSelectedIds.size === 0}
              className="gradient-primary text-primary-foreground"
            >
              {savingBudget ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
              Add {budgetSelectedIds.size} Items
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ProjectPortal;
