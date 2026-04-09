import React, { useState, useMemo, useEffect } from 'react';
import { Check, Loader2, FileSpreadsheet, Percent, Hammer, Package, HardHat, UserPlus, Search, AlertTriangle, Pencil, ChevronDown, ChevronRight, Home, TreePine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { useBudgetLineItems, useAllSubBudgetLineItemsForProject } from '@/hooks/useProjects';
import type { DbTeamMember } from '@/hooks/useProjects';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

export interface EditProposalData {
  id: string;
  team_member_id: string;
  proposal_name: string;
  bid_percentage: number;
  file_name: string;
  lineItems: any[];
}

interface SubProposalBuilderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  currentUserId: string;
  assignedSubs: DbTeamMember[];
  editData?: EditProposalData | null;
}

interface NewSubDetails {
  name: string;
  email: string;
  phone: string;
  crewName: string;
  companyName: string;
  location: string;
  specialties: string;
  notes: string;
}

// Unique key for matching master ↔ sub items
function itemKey(item: { cost_item_name: string; cost_group: string; line_item_no: number }) {
  return `${item.line_item_no}|||${item.cost_item_name}|||${item.cost_group}`;
}

const DRAW_CATEGORY_CONFIG = {
  'interior-buildout': { label: 'Interior', icon: Home, color: 'text-indigo-600', bgColor: 'bg-indigo-500/10 border-indigo-500/20' },
  'exterior': { label: 'Exterior', icon: TreePine, color: 'text-emerald-600', bgColor: 'bg-emerald-500/10 border-emerald-500/20' },
  '': { label: 'Other', icon: Package, color: 'text-muted-foreground', bgColor: 'bg-muted/30 border-border' },
} as const;

const COST_TYPE_CONFIG: Record<string, { icon: typeof Hammer; label: string; color: string; bgColor: string }> = {
  Labor: { icon: Hammer, label: 'Labor', color: 'text-blue-600', bgColor: 'bg-blue-500/10 border-blue-500/20' },
  Subcontractor: { icon: HardHat, label: 'Subcontractor', color: 'text-amber-600', bgColor: 'bg-amber-500/10 border-amber-500/20' },
  Materials: { icon: Package, label: 'Materials', color: 'text-emerald-600', bgColor: 'bg-emerald-500/10 border-emerald-500/20' },
};

const SubProposalBuilder: React.FC<SubProposalBuilderProps> = ({
  open,
  onOpenChange,
  projectId,
  currentUserId,
  assignedSubs,
  editData,
}) => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: masterItems = [] } = useBudgetLineItems(projectId);
  const { data: allAssignedItems = [] } = useAllSubBudgetLineItemsForProject(projectId);

  const isEditMode = !!editData;

  const [selectedSubId, setSelectedSubId] = useState('');
  const [isNewSub, setIsNewSub] = useState(false);
  const [newSubName, setNewSubName] = useState('');
  const [proposalName, setProposalName] = useState('');
  const [bidPercentage, setBidPercentage] = useState(60);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [overrides, setOverrides] = useState<Map<string, number>>(new Map());
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [newSubDetails, setNewSubDetails] = useState<NewSubDetails>({
    name: '', email: '', phone: '', crewName: '', companyName: '', location: '', specialties: '', notes: '',
  });
  const [savingDetails, setSavingDetails] = useState(false);
  const [pendingBudgetId, setPendingBudgetId] = useState<string | null>(null);
  const [pendingTeamMemberId, setPendingTeamMemberId] = useState<string | null>(null);
  // Collapsed sections: draw categories
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  // Collapsed cost type sections within a category
  const [collapsedTypes, setCollapsedTypes] = useState<Set<string>>(new Set());

  const toggleCategory = (cat: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  const toggleTypeCollapse = (key: string) => {
    setCollapsedTypes(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // Populate fields when editing
  useEffect(() => {
    if (editData && open) {
      setSelectedSubId(editData.team_member_id);
      setProposalName(editData.proposal_name || editData.file_name || '');
      setBidPercentage(editData.bid_percentage || 60);
      setIsNewSub(false);

      const editItemKeys = new Set(editData.lineItems.map((li: any) => itemKey(li)));
      const matchedIds = new Set<string>();
      const priceOverrides = new Map<string, number>();

      masterItems.forEach(mi => {
        const key = itemKey(mi);
        if (editItemKeys.has(key)) {
          matchedIds.add(mi.id);
          const editItem = editData.lineItems.find((li: any) => itemKey(li) === key);
          if (editItem) {
            priceOverrides.set(mi.id, Number(editItem.contract_price));
          }
        }
      });
      setSelectedIds(matchedIds);
      setOverrides(priceOverrides);
    }
  }, [editData, open, masterItems]);

  // Build a map of master item IDs already assigned in OTHER proposals
  const assignedItemMap = useMemo(() => {
    const map = new Map<string, { subName: string; proposalName: string; subBudgetId: string }>();
    allAssignedItems.forEach((item: any) => {
      if (editData && item.sub_budget_id === editData.id) return;

      // Match using the composite key
      const matchingMaster = masterItems.find(mi => itemKey(mi) === itemKey(item));
      if (matchingMaster) {
        const budget = item._budget;
        const subName = budget?.team_members?.crew_name || budget?.team_members?.name || 'Unknown';
        const pName = budget?.proposal_name || budget?.file_name || 'Proposal';
        map.set(matchingMaster.id, { subName, proposalName: pName, subBudgetId: item.sub_budget_id });
      }
    });
    return map;
  }, [allAssignedItems, masterItems, editData]);

  // Auto-generate proposal name
  const autoProposalName = useMemo(() => {
    if (selectedIds.size === 0) return '';
    const groups = new Set<string>();
    masterItems.forEach(i => {
      if (selectedIds.has(i.id)) {
        const topGroup = (i.cost_group || '').split(';')[0].trim();
        if (topGroup) groups.add(topGroup);
      }
    });
    if (groups.size === 0) return '';
    const arr = Array.from(groups);
    if (arr.length <= 3) return arr.join(', ');
    return arr.slice(0, 2).join(', ') + ` +${arr.length - 2} more`;
  }, [selectedIds, masterItems]);

  // Group items: draw_category → cost_type → cost_group
  const categorySections = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const filtered = q
      ? masterItems.filter(i =>
          i.cost_item_name.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q) ||
          i.cost_group.toLowerCase().includes(q) ||
          i.cost_code.toLowerCase().includes(q) ||
          i.cost_type.toLowerCase().includes(q) ||
          i.draw_category.toLowerCase().includes(q))
      : masterItems;

    const catOrder = ['interior-buildout', 'exterior', ''];
    const typeOrder = ['Labor', 'Subcontractor', 'Materials'];

    const result: {
      category: string;
      catConfig: typeof DRAW_CATEGORY_CONFIG[keyof typeof DRAW_CATEGORY_CONFIG];
      items: typeof masterItems;
      typeSections: {
        type: string;
        typeConfig: typeof COST_TYPE_CONFIG[string];
        groups: Map<string, typeof masterItems>;
        allItems: typeof masterItems;
      }[];
    }[] = [];

    catOrder.forEach(cat => {
      const catItems = filtered.filter(i => (i.draw_category || '') === cat);
      if (catItems.length === 0) return;

      const catConf = DRAW_CATEGORY_CONFIG[cat as keyof typeof DRAW_CATEGORY_CONFIG] || DRAW_CATEGORY_CONFIG[''];

      const typeSections: typeof result[0]['typeSections'] = [];
      typeOrder.forEach(type => {
        const typeItems = catItems.filter(i => (i.cost_type || 'Labor') === type);
        if (typeItems.length === 0) return;
        const groups = new Map<string, typeof masterItems>();
        typeItems.forEach(item => {
          const group = item.cost_group || 'Ungrouped';
          if (!groups.has(group)) groups.set(group, []);
          groups.get(group)!.push(item);
        });
        typeSections.push({
          type,
          typeConfig: COST_TYPE_CONFIG[type] || COST_TYPE_CONFIG['Labor'],
          groups,
          allItems: typeItems,
        });
      });

      // Other types
      const knownTypes = new Set(typeOrder);
      const otherItems = catItems.filter(i => !knownTypes.has(i.cost_type || 'Labor'));
      if (otherItems.length > 0) {
        const groups = new Map<string, typeof masterItems>();
        otherItems.forEach(item => {
          const group = item.cost_group || 'Ungrouped';
          if (!groups.has(group)) groups.set(group, []);
          groups.get(group)!.push(item);
        });
        typeSections.push({
          type: 'Other',
          typeConfig: { icon: Package, label: 'Other', color: 'text-muted-foreground', bgColor: 'bg-muted/30 border-border' },
          groups,
          allItems: otherItems,
        });
      }

      result.push({ category: cat, catConfig: catConf, items: catItems, typeSections });
    });

    return result;
  }, [masterItems, searchQuery]);

  const getContractPrice = (item: typeof masterItems[0]) => {
    if (overrides.has(item.id)) return overrides.get(item.id)!;
    return Math.round(Number(item.extended_cost) * (bidPercentage / 100) * 100) / 100;
  };

  const selectedItems = masterItems.filter(i => selectedIds.has(i.id));
  const proposalTotal = selectedItems.reduce((s, i) => s + getContractPrice(i), 0);

  const toggleItem = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleGroup = (items: typeof masterItems) => {
    const unassignedItems = items.filter(i => !assignedItemMap.has(i.id));
    const allSelected = unassignedItems.every(i => selectedIds.has(i.id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      unassignedItems.forEach(i => {
        if (allSelected) next.delete(i.id); else next.add(i.id);
      });
      return next;
    });
  };

  const toggleAllOfType = (categoryItems: typeof masterItems) => {
    const unassignedItems = categoryItems.filter(i => !assignedItemMap.has(i.id));
    const allSelected = unassignedItems.every(i => selectedIds.has(i.id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      unassignedItems.forEach(i => {
        if (allSelected) next.delete(i.id); else next.add(i.id);
      });
      return next;
    });
  };

  const toggleAllOfCategory = (items: typeof masterItems) => {
    const unassignedItems = items.filter(i => !assignedItemMap.has(i.id));
    const allSelected = unassignedItems.every(i => selectedIds.has(i.id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      unassignedItems.forEach(i => {
        if (allSelected) next.delete(i.id); else next.add(i.id);
      });
      return next;
    });
  };

  const reset = () => {
    setSelectedSubId('');
    setIsNewSub(false);
    setNewSubName('');
    setProposalName('');
    setBidPercentage(60);
    setSelectedIds(new Set());
    setOverrides(new Map());
    setSearchQuery('');
    setPendingBudgetId(null);
    setPendingTeamMemberId(null);
    setCollapsedCategories(new Set());
    setCollapsedTypes(new Set());
  };

  const handleSubChange = (val: string) => {
    if (val === '__new__') { setIsNewSub(true); setSelectedSubId(''); }
    else { setIsNewSub(false); setSelectedSubId(val); }
  };

  const createTeamMemberAndProposal = async (): Promise<{ teamMemberId: string; budgetId: string }> => {
    const { data: tm, error: tmErr } = await supabase
      .from('team_members')
      .insert({ name: newSubName.trim(), email: '', role: 'subcontractor' as any })
      .select().single();
    if (tmErr) throw tmErr;
    await supabase.from('project_assignments').insert({ project_id: projectId, team_member_id: tm.id });
    const { data: budget, error: bErr } = await supabase
      .from('sub_budgets' as any)
      .insert({ project_id: projectId, team_member_id: tm.id, uploaded_by: currentUserId, file_name: proposalName || 'Proposal', proposal_name: proposalName, bid_percentage: bidPercentage })
      .select().single();
    if (bErr) throw bErr;
    return { teamMemberId: tm.id, budgetId: (budget as any).id };
  };

  const createProposalForExisting = async (): Promise<string> => {
    const { data: budget, error: bErr } = await supabase
      .from('sub_budgets' as any)
      .insert({ project_id: projectId, team_member_id: selectedSubId, uploaded_by: currentUserId, file_name: proposalName || 'Proposal', proposal_name: proposalName, bid_percentage: bidPercentage })
      .select().single();
    if (bErr) throw bErr;
    return (budget as any).id;
  };

  const buildLineItemRows = (budgetId: string) =>
    selectedItems.map((item, idx) => ({
      sub_budget_id: budgetId,
      line_item_no: item.line_item_no,
      cost_group: item.cost_group,
      cost_item_name: item.cost_item_name,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      extended_cost: Number(item.extended_cost),
      cost_type: item.cost_type,
      cost_code: item.cost_code,
      batch_label: proposalName || 'Proposal',
      contract_price: getContractPrice(item),
    }));

  const insertLineItems = async (budgetId: string) => {
    const rows = buildLineItemRows(budgetId);
    const { error: liErr } = await supabase.from('sub_budget_line_items' as any).insert(rows);
    if (liErr) throw liErr;
  };

  const invalidateCaches = () => {
    qc.invalidateQueries({ queryKey: ['sub_budgets', projectId] });
    qc.invalidateQueries({ queryKey: ['sub_budget_line_items'] });
    qc.invalidateQueries({ queryKey: ['sub_bid_total', projectId] });
    qc.invalidateQueries({ queryKey: ['team_members'] });
    qc.invalidateQueries({ queryKey: ['project_assignments', projectId] });
    qc.invalidateQueries({ queryKey: ['all_sub_budget_line_items', projectId] });
  };

  const handleSave = async () => {
    if (isEditMode) { await handleUpdate(); return; }
    if ((!selectedSubId && !isNewSub) || selectedIds.size === 0) return;
    if (isNewSub && !newSubName.trim()) return;
    setSaving(true);
    try {
      if (isNewSub) {
        const { teamMemberId, budgetId } = await createTeamMemberAndProposal();
        await insertLineItems(budgetId);
        setPendingBudgetId(budgetId);
        setPendingTeamMemberId(teamMemberId);
        setNewSubDetails({ name: newSubName.trim(), email: '', phone: '', crewName: '', companyName: '', location: '', specialties: '', notes: '' });
        invalidateCaches();
        toast({ title: 'Proposal created', description: `${selectedItems.length} items assigned — now add their details.` });
        onOpenChange(false);
        setShowDetailsDialog(true);
      } else {
        const budgetId = await createProposalForExisting();
        await insertLineItems(budgetId);
        const subName = assignedSubs.find(s => s.id === selectedSubId)?.crew_name || assignedSubs.find(s => s.id === selectedSubId)?.name || 'team member';
        toast({ title: 'Proposal created', description: `${selectedItems.length} items assigned to ${subName} — $${proposalTotal.toLocaleString()} total.` });
        invalidateCaches();
        reset();
        onOpenChange(false);
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const handleUpdate = async () => {
    if (!editData || selectedIds.size === 0) return;
    setSaving(true);
    try {
      await supabase.from('sub_budgets' as any).update({ team_member_id: selectedSubId, proposal_name: proposalName, file_name: proposalName || 'Proposal', bid_percentage: bidPercentage }).eq('id', editData.id);
      await supabase.from('sub_budget_line_items' as any).delete().eq('sub_budget_id', editData.id);
      const rows = buildLineItemRows(editData.id);
      if (rows.length > 0) {
        const { error: liErr } = await supabase.from('sub_budget_line_items' as any).insert(rows);
        if (liErr) throw liErr;
      }
      toast({ title: 'Proposal updated', description: `${selectedItems.length} items — $${proposalTotal.toLocaleString()} total.` });
      invalidateCaches();
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const handleSaveDetails = async () => {
    if (!pendingTeamMemberId) return;
    setSavingDetails(true);
    try {
      const updateData: any = {};
      if (newSubDetails.email) updateData.email = newSubDetails.email;
      if (newSubDetails.phone) updateData.phone = newSubDetails.phone;
      if (newSubDetails.crewName) updateData.crew_name = newSubDetails.crewName;
      if (newSubDetails.name) updateData.name = newSubDetails.name;
      if (Object.keys(updateData).length > 0) await supabase.from('team_members').update(updateData).eq('id', pendingTeamMemberId);
      if (newSubDetails.companyName.trim()) {
        await supabase.from('subcontractor_directory').insert({
          company_name: newSubDetails.companyName.trim(), contact_name: newSubDetails.name, email: newSubDetails.email,
          phone: newSubDetails.phone, location: newSubDetails.location,
          specialties: newSubDetails.specialties ? newSubDetails.specialties.split(',').map(s => s.trim()).filter(Boolean) : [],
          notes: newSubDetails.notes, created_by: currentUserId,
        });
      }
      toast({ title: 'Subcontractor added', description: `${newSubDetails.name || 'Subcontractor'} has been added to the system.` });
      qc.invalidateQueries({ queryKey: ['team_members'] });
      qc.invalidateQueries({ queryKey: ['subcontractor_directory'] });
      setShowDetailsDialog(false);
      reset();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally { setSavingDetails(false); }
  };

  const handleSkipDetails = () => {
    setShowDetailsDialog(false);
    reset();
    toast({ title: 'Proposal saved', description: 'You can update the subcontractor details later from Team Management.' });
  };

  const canSave = isEditMode
    ? (selectedSubId && selectedIds.size > 0)
    : isNewSub ? (newSubName.trim().length > 0 && selectedIds.size > 0) : (selectedSubId && selectedIds.size > 0);

  return (
    <TooltipProvider>
      {/* Main Builder — full width dialog */}
      <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
        <DialogContent className="sm:max-w-5xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              {isEditMode ? <Pencil className="w-5 h-5" /> : <FileSpreadsheet className="w-5 h-5" />}
              {isEditMode ? 'Edit Proposal' : 'Create Sub Proposal'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Sub + proposal name + bid % in a row */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-sm font-display font-semibold">Subcontractor</Label>
                {isEditMode ? (
                  <Select value={selectedSubId} onValueChange={setSelectedSubId}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Choose..." /></SelectTrigger>
                    <SelectContent>
                      {assignedSubs.map(s => <SelectItem key={s.id} value={s.id}>{s.crew_name || s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <>
                    <Select value={isNewSub ? '__new__' : selectedSubId} onValueChange={handleSubChange}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Choose..." /></SelectTrigger>
                      <SelectContent>
                        {assignedSubs.map(s => <SelectItem key={s.id} value={s.id}>{s.crew_name || s.name}</SelectItem>)}
                        <SelectItem value="__new__"><span className="flex items-center gap-1.5"><UserPlus className="w-3.5 h-3.5" />Add New Subcontractor</span></SelectItem>
                      </SelectContent>
                    </Select>
                    {isNewSub && <Input className="mt-2" placeholder="Subcontractor name..." value={newSubName} onChange={e => setNewSubName(e.target.value)} autoFocus />}
                  </>
                )}
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-display font-semibold">Proposal Name</Label>
                  {!proposalName && autoProposalName && (
                    <button type="button" className="text-xs text-primary hover:underline" onClick={() => setProposalName(autoProposalName)}>
                      Use: {autoProposalName.length > 25 ? autoProposalName.slice(0, 25) + '…' : autoProposalName}
                    </button>
                  )}
                </div>
                <Input className="mt-1" placeholder="e.g. Phase 1 - Framing" value={proposalName} onChange={e => setProposalName(e.target.value)} />
              </div>
              <div>
                <Label className="text-sm font-display font-semibold">Bid %</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Percent className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <Input
                    type="number" min="1" max="200"
                    className="text-center font-display font-bold"
                    value={bidPercentage}
                    onChange={e => { setBidPercentage(Number(e.target.value)); setOverrides(new Map()); }}
                  />
                  <span className="text-sm font-display text-muted-foreground">of cost</span>
                </div>
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search items... e.g. painting, drywall, framing" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground">Clear</button>
              )}
            </div>

            {/* Item selection — Interior/Exterior collapsible sections */}
            {masterItems.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No master budget items found. Import a master budget first.</p>
            ) : (
              <div className="space-y-3">
                {categorySections.map(({ category, catConfig, items: catItems, typeSections }) => {
                  const CatIcon = catConfig.icon;
                  const isCatCollapsed = collapsedCategories.has(category);
                  const catSelectedCount = catItems.filter(i => selectedIds.has(i.id)).length;
                  const catTotal = catItems.reduce((s, i) => s + Number(i.extended_cost), 0);
                  const unassignedCatItems = catItems.filter(i => !assignedItemMap.has(i.id));
                  const allCatSelected = unassignedCatItems.length > 0 && unassignedCatItems.every(i => selectedIds.has(i.id));

                  return (
                    <div key={category} className={`border-2 rounded-xl overflow-hidden ${catConfig.bgColor}`}>
                      {/* Category header */}
                      <div className="px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={(e) => { e.stopPropagation(); toggleAllOfCategory(catItems); }}
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                              allCatSelected ? 'border-primary bg-primary' : catSelectedCount > 0 ? 'border-primary bg-primary/30' : 'border-muted-foreground/40 hover:border-primary/60'
                            }`}>
                            {allCatSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                          </button>
                          <button type="button" onClick={() => toggleCategory(category)} className="flex items-center gap-2">
                            {isCatCollapsed ? <ChevronRight className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                            <CatIcon className={`w-5 h-5 ${catConfig.color}`} />
                            <span className={`font-display font-bold text-base ${catConfig.color}`}>{catConfig.label}</span>
                            <span className="text-sm text-muted-foreground">({catItems.length} items)</span>
                          </button>
                        </div>
                        <div className="flex items-center gap-4">
                          {catSelectedCount > 0 && <Badge variant="secondary" className="font-display">{catSelectedCount} selected</Badge>}
                          <span className="font-display font-bold text-sm">${catTotal.toLocaleString()}</span>
                        </div>
                      </div>

                      {/* Category content */}
                      {!isCatCollapsed && (
                        <div className="bg-background/80 space-y-2 p-2">
                          {typeSections.map(({ type, typeConfig, groups, allItems: typeItems }) => {
                            const TypeIcon = typeConfig.icon;
                            const typeKey = `${category}__${type}`;
                            const isTypeCollapsed = collapsedTypes.has(typeKey);
                            const typeSelectedCount = typeItems.filter(i => selectedIds.has(i.id)).length;
                            const typeTotal = typeItems.reduce((s, i) => s + Number(i.extended_cost), 0);
                            const unassignedTypeItems = typeItems.filter(i => !assignedItemMap.has(i.id));
                            const allTypeSelected = unassignedTypeItems.length > 0 && unassignedTypeItems.every(i => selectedIds.has(i.id));

                            return (
                              <div key={type} className={`border rounded-lg overflow-hidden ${typeConfig.bgColor}`}>
                                <div className="px-3 py-2 flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <button type="button" onClick={(e) => { e.stopPropagation(); toggleAllOfType(typeItems); }}
                                      className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                        allTypeSelected ? 'border-primary bg-primary' : typeSelectedCount > 0 ? 'border-primary bg-primary/30' : 'border-muted-foreground/40 hover:border-primary/60'
                                      }`}>
                                      {allTypeSelected && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                                    </button>
                                    <button type="button" onClick={() => toggleTypeCollapse(typeKey)} className="flex items-center gap-2">
                                      {isTypeCollapsed ? <ChevronRight className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                                      <TypeIcon className={`w-4 h-4 ${typeConfig.color}`} />
                                      <span className={`font-display font-bold text-sm ${typeConfig.color}`}>{typeConfig.label}</span>
                                      <span className="text-xs text-muted-foreground">({typeItems.length})</span>
                                    </button>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    {typeSelectedCount > 0 && <span className="text-xs font-display font-semibold">{typeSelectedCount} selected</span>}
                                    <span className="text-xs font-display font-semibold">${typeTotal.toLocaleString()}</span>
                                  </div>
                                </div>

                                {!isTypeCollapsed && (
                                  <div className="bg-background/80 max-h-[40vh] overflow-y-auto">
                                    {Array.from(groups.entries()).map(([group, items]) => {
                                      const unassignedGroupItems = items.filter(i => !assignedItemMap.has(i.id));
                                      const allGroupSelected = unassignedGroupItems.length > 0 && unassignedGroupItems.every(i => selectedIds.has(i.id));
                                      const someGroupSelected = items.some(i => selectedIds.has(i.id));

                                      return (
                                        <div key={group}>
                                          <button type="button" onClick={() => toggleGroup(items)}
                                            className="w-full flex items-center gap-2 px-4 py-2 bg-muted/40 hover:bg-muted/60 transition-colors sticky top-0 z-10 border-t border-border/50">
                                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                                              allGroupSelected ? 'border-primary bg-primary' : someGroupSelected ? 'border-primary bg-primary/30' : 'border-muted-foreground/40'
                                            }`}>
                                              {allGroupSelected && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                                            </div>
                                            <span className="font-display font-semibold text-xs flex-1 text-left">{group}</span>
                                            <span className="text-xs text-muted-foreground">{items.length} items · ${items.reduce((s, i) => s + Number(i.extended_cost), 0).toLocaleString()}</span>
                                          </button>
                                          {items.map(item => {
                                            const isSelected = selectedIds.has(item.id);
                                            const contractPrice = getContractPrice(item);
                                            const hasOverride = overrides.has(item.id);
                                            const assignment = assignedItemMap.get(item.id);

                                            return (
                                              <div key={item.id} className={`flex items-center gap-2 px-4 py-2 border-t border-border/30 ${isSelected ? 'bg-primary/5' : ''} ${assignment ? 'opacity-50' : ''}`}>
                                                <button type="button"
                                                  onClick={() => { if (!assignment) toggleItem(item.id); }}
                                                  className={`flex items-center gap-2 flex-1 min-w-0 text-left ${assignment ? 'cursor-not-allowed' : ''}`}
                                                  disabled={!!assignment}>
                                                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                                                    assignment ? 'border-muted-foreground/20 bg-muted' :
                                                    isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/40'
                                                  }`}>
                                                    {isSelected && !assignment && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                                                  </div>
                                                  <div className="flex-1 min-w-0">
                                                    <span className="text-sm font-display">
                                                      <span className="text-muted-foreground mr-1">#{item.line_item_no}</span>
                                                      {item.cost_item_name}
                                                    </span>
                                                  </div>
                                                  <span className="text-xs text-muted-foreground flex-shrink-0">${Number(item.extended_cost).toLocaleString()}</span>
                                                </button>
                                                {assignment && (
                                                  <Tooltip>
                                                    <TooltipTrigger asChild>
                                                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 flex-shrink-0 border-amber-400/50 text-amber-600 gap-1 cursor-help">
                                                        <AlertTriangle className="w-2.5 h-2.5" />
                                                        {assignment.subName}
                                                      </Badge>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="left" className="text-xs">
                                                      Already in <strong>{assignment.proposalName}</strong> for <strong>{assignment.subName}</strong>
                                                    </TooltipContent>
                                                  </Tooltip>
                                                )}
                                                {isSelected && !assignment && (
                                                  <div className="flex items-center gap-1 flex-shrink-0">
                                                    <span className="text-xs text-muted-foreground">→</span>
                                                    <Input
                                                      type="number"
                                                      className={`w-24 h-7 text-xs text-right font-display font-semibold ${hasOverride ? 'border-accent' : ''}`}
                                                      value={contractPrice}
                                                      onChange={e => {
                                                        const val = Number(e.target.value);
                                                        setOverrides(prev => { const next = new Map(prev); next.set(item.id, val); return next; });
                                                      }}
                                                      onClick={e => e.stopPropagation()}
                                                    />
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Summary */}
            {selectedIds.size > 0 && (
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border">
                <span className="font-display text-sm">{selectedIds.size} items selected</span>
                <span className="font-display font-bold text-lg">Proposal Total: ${proposalTotal.toLocaleString()}</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !canSave} className="gradient-primary text-primary-foreground">
              {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : isEditMode ? <Pencil className="w-4 h-4 mr-1" /> : <Check className="w-4 h-4 mr-1" />}
              {isEditMode ? 'Update Proposal' : isNewSub ? 'Create Proposal & Add Sub' : 'Create Proposal'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Sub Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={(v) => { if (!v) handleSkipDetails(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2"><UserPlus className="w-5 h-5" />Complete Subcontractor Profile</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">The proposal has been saved. Fill in the rest of the details to add <strong>{newSubDetails.name}</strong> to your team and subcontractor directory.</p>
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs font-display font-semibold">Full Name</Label><Input className="mt-1" value={newSubDetails.name} onChange={e => setNewSubDetails(d => ({ ...d, name: e.target.value }))} /></div>
              <div><Label className="text-xs font-display font-semibold">Crew Name</Label><Input className="mt-1" placeholder="e.g. Smith Painting" value={newSubDetails.crewName} onChange={e => setNewSubDetails(d => ({ ...d, crewName: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs font-display font-semibold">Email</Label><Input className="mt-1" type="email" placeholder="sub@email.com" value={newSubDetails.email} onChange={e => setNewSubDetails(d => ({ ...d, email: e.target.value }))} /></div>
              <div><Label className="text-xs font-display font-semibold">Phone</Label><Input className="mt-1" placeholder="(555) 123-4567" value={newSubDetails.phone} onChange={e => setNewSubDetails(d => ({ ...d, phone: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs font-display font-semibold">Company Name</Label><Input className="mt-1" placeholder="For directory listing" value={newSubDetails.companyName} onChange={e => setNewSubDetails(d => ({ ...d, companyName: e.target.value }))} /></div>
              <div><Label className="text-xs font-display font-semibold">Location</Label><Input className="mt-1" placeholder="City, State" value={newSubDetails.location} onChange={e => setNewSubDetails(d => ({ ...d, location: e.target.value }))} /></div>
            </div>
            <div><Label className="text-xs font-display font-semibold">Specialties <span className="text-muted-foreground font-normal">(comma-separated)</span></Label><Input className="mt-1" placeholder="e.g. Painting, Drywall, Finishing" value={newSubDetails.specialties} onChange={e => setNewSubDetails(d => ({ ...d, specialties: e.target.value }))} /></div>
            <div><Label className="text-xs font-display font-semibold">Notes</Label><Textarea className="mt-1" placeholder="Any notes about this subcontractor..." rows={2} value={newSubDetails.notes} onChange={e => setNewSubDetails(d => ({ ...d, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={handleSkipDetails}>Skip for now</Button>
            <Button onClick={handleSaveDetails} disabled={savingDetails} className="gradient-primary text-primary-foreground">
              {savingDetails ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <UserPlus className="w-4 h-4 mr-1" />}Save Details
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
};

export default SubProposalBuilder;
