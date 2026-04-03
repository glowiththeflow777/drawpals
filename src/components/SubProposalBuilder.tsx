import React, { useState, useMemo } from 'react';
import { Check, Loader2, FileSpreadsheet, Percent, Hammer, Package, HardHat, UserPlus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useBudgetLineItems } from '@/hooks/useProjects';
import type { DbTeamMember } from '@/hooks/useProjects';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

interface SubProposalBuilderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  currentUserId: string;
  assignedSubs: DbTeamMember[];
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

const SubProposalBuilder: React.FC<SubProposalBuilderProps> = ({
  open,
  onOpenChange,
  projectId,
  currentUserId,
  assignedSubs,
}) => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: masterItems = [] } = useBudgetLineItems(projectId);

  const [selectedSubId, setSelectedSubId] = useState('');
  const [isNewSub, setIsNewSub] = useState(false);
  const [newSubName, setNewSubName] = useState('');
  const [proposalName, setProposalName] = useState('');
  const [bidPercentage, setBidPercentage] = useState(60);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [overrides, setOverrides] = useState<Map<string, number>>(new Map());
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // Step 2: details dialog for new sub
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [newSubDetails, setNewSubDetails] = useState<NewSubDetails>({
    name: '', email: '', phone: '', crewName: '', companyName: '', location: '', specialties: '', notes: '',
  });
  const [savingDetails, setSavingDetails] = useState(false);
  // Store pending data between steps
  const [pendingBudgetId, setPendingBudgetId] = useState<string | null>(null);
  const [pendingTeamMemberId, setPendingTeamMemberId] = useState<string | null>(null);

  // Group master items by cost type → cost group
  const costTypeSections = useMemo(() => {
    const typeOrder = ['Labor', 'Subcontractor', 'Materials'];
    const typeConfig: Record<string, { icon: typeof Hammer; label: string; color: string; bgColor: string }> = {
      Labor: { icon: Hammer, label: 'Labor', color: 'text-blue-600', bgColor: 'bg-blue-500/10 border-blue-500/20' },
      Subcontractor: { icon: HardHat, label: 'Subcontractor', color: 'text-amber-600', bgColor: 'bg-amber-500/10 border-amber-500/20' },
      Materials: { icon: Package, label: 'Materials', color: 'text-emerald-600', bgColor: 'bg-emerald-500/10 border-emerald-500/20' },
    };

    const q = searchQuery.toLowerCase().trim();
    const filtered = q
      ? masterItems.filter(i =>
          i.cost_item_name.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q) ||
          i.cost_group.toLowerCase().includes(q) ||
          i.cost_code.toLowerCase().includes(q) ||
          i.cost_type.toLowerCase().includes(q))
      : masterItems;

    const sections: { type: string; config: typeof typeConfig[string]; groups: Map<string, typeof masterItems> }[] = [];

    typeOrder.forEach(type => {
      const typeItems = filtered.filter(i => (i.cost_type || 'Labor') === type);
      if (typeItems.length === 0) return;
      const groups = new Map<string, typeof masterItems>();
      typeItems.forEach(item => {
        const group = item.cost_group || 'Ungrouped';
        if (!groups.has(group)) groups.set(group, []);
        groups.get(group)!.push(item);
      });
      sections.push({ type, config: typeConfig[type] || typeConfig['Labor'], groups });
    });

    const knownTypes = new Set(typeOrder);
    const otherItems = filtered.filter(i => !knownTypes.has(i.cost_type || 'Labor'));
    if (otherItems.length > 0) {
      const groups = new Map<string, typeof masterItems>();
      otherItems.forEach(item => {
        const group = item.cost_group || 'Ungrouped';
        if (!groups.has(group)) groups.set(group, []);
        groups.get(group)!.push(item);
      });
      sections.push({ type: 'Other', config: { icon: Package, label: 'Other', color: 'text-muted-foreground', bgColor: 'bg-muted/30 border-border' }, groups });
    }

    return sections;
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
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleGroup = (items: typeof masterItems) => {
    const allSelected = items.every(i => selectedIds.has(i.id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      items.forEach(i => {
        if (allSelected) next.delete(i.id);
        else next.add(i.id);
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
    setPendingBudgetId(null);
    setPendingTeamMemberId(null);
  };

  const handleSubChange = (val: string) => {
    if (val === '__new__') {
      setIsNewSub(true);
      setSelectedSubId('');
    } else {
      setIsNewSub(false);
      setSelectedSubId(val);
    }
  };

  // Create the team member with just a name, then create the proposal
  const createTeamMemberAndProposal = async (): Promise<{ teamMemberId: string; budgetId: string }> => {
    // Create team_member with just the name
    const { data: tm, error: tmErr } = await supabase
      .from('team_members')
      .insert({ name: newSubName.trim(), email: '', role: 'subcontractor' as any })
      .select()
      .single();
    if (tmErr) throw tmErr;

    const teamMemberId = tm.id;

    // Also assign them to this project
    await supabase
      .from('project_assignments')
      .insert({ project_id: projectId, team_member_id: teamMemberId });

    // Create the sub_budget (proposal)
    const { data: budget, error: bErr } = await supabase
      .from('sub_budgets' as any)
      .insert({
        project_id: projectId,
        team_member_id: teamMemberId,
        uploaded_by: currentUserId,
        file_name: proposalName || 'Proposal',
        proposal_name: proposalName,
        bid_percentage: bidPercentage,
      })
      .select()
      .single();
    if (bErr) throw bErr;

    return { teamMemberId, budgetId: (budget as any).id };
  };

  const createProposalForExisting = async (): Promise<string> => {
    const { data: budget, error: bErr } = await supabase
      .from('sub_budgets' as any)
      .insert({
        project_id: projectId,
        team_member_id: selectedSubId,
        uploaded_by: currentUserId,
        file_name: proposalName || 'Proposal',
        proposal_name: proposalName,
        bid_percentage: bidPercentage,
      })
      .select()
      .single();
    if (bErr) throw bErr;
    return (budget as any).id;
  };

  const insertLineItems = async (budgetId: string) => {
    const rows = selectedItems.map((item, idx) => ({
      sub_budget_id: budgetId,
      line_item_no: idx + 1,
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

    const { error: liErr } = await supabase.from('sub_budget_line_items' as any).insert(rows);
    if (liErr) throw liErr;
  };

  const invalidateCaches = () => {
    qc.invalidateQueries({ queryKey: ['sub_budgets', projectId] });
    qc.invalidateQueries({ queryKey: ['sub_budget_line_items'] });
    qc.invalidateQueries({ queryKey: ['sub_bid_total', projectId] });
    qc.invalidateQueries({ queryKey: ['team_members'] });
    qc.invalidateQueries({ queryKey: ['project_assignments', projectId] });
  };

  const handleSave = async () => {
    if ((!selectedSubId && !isNewSub) || selectedIds.size === 0) return;
    if (isNewSub && !newSubName.trim()) return;
    setSaving(true);
    try {
      if (isNewSub) {
        const { teamMemberId, budgetId } = await createTeamMemberAndProposal();
        await insertLineItems(budgetId);

        // Store pending info and open details dialog
        setPendingBudgetId(budgetId);
        setPendingTeamMemberId(teamMemberId);
        setNewSubDetails({
          name: newSubName.trim(),
          email: '', phone: '', crewName: '', companyName: '', location: '', specialties: '', notes: '',
        });

        invalidateCaches();

        toast({
          title: 'Proposal created',
          description: `${selectedItems.length} items assigned — now add their details.`,
        });

        // Close proposal dialog, open details dialog
        onOpenChange(false);
        setShowDetailsDialog(true);
      } else {
        const budgetId = await createProposalForExisting();
        await insertLineItems(budgetId);

        const subName = assignedSubs.find(s => s.id === selectedSubId)?.crew_name ||
                        assignedSubs.find(s => s.id === selectedSubId)?.name || 'team member';

        toast({
          title: 'Proposal created',
          description: `${selectedItems.length} items assigned to ${subName} — $${proposalTotal.toLocaleString()} total.`,
        });

        invalidateCaches();
        reset();
        onOpenChange(false);
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDetails = async () => {
    if (!pendingTeamMemberId) return;
    setSavingDetails(true);
    try {
      // Update team_member with full details
      const updateData: any = {};
      if (newSubDetails.email) updateData.email = newSubDetails.email;
      if (newSubDetails.phone) updateData.phone = newSubDetails.phone;
      if (newSubDetails.crewName) updateData.crew_name = newSubDetails.crewName;
      if (newSubDetails.name) updateData.name = newSubDetails.name;

      if (Object.keys(updateData).length > 0) {
        await supabase.from('team_members').update(updateData).eq('id', pendingTeamMemberId);
      }

      // Also add to subcontractor directory if company name provided
      if (newSubDetails.companyName.trim()) {
        await supabase.from('subcontractor_directory').insert({
          company_name: newSubDetails.companyName.trim(),
          contact_name: newSubDetails.name,
          email: newSubDetails.email,
          phone: newSubDetails.phone,
          location: newSubDetails.location,
          specialties: newSubDetails.specialties ? newSubDetails.specialties.split(',').map(s => s.trim()).filter(Boolean) : [],
          notes: newSubDetails.notes,
          created_by: currentUserId,
        });
      }

      toast({ title: 'Subcontractor added', description: `${newSubDetails.name || 'Subcontractor'} has been added to the system.` });

      qc.invalidateQueries({ queryKey: ['team_members'] });
      qc.invalidateQueries({ queryKey: ['subcontractor_directory'] });

      setShowDetailsDialog(false);
      reset();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSavingDetails(false);
    }
  };

  const handleSkipDetails = () => {
    setShowDetailsDialog(false);
    reset();
    toast({ title: 'Proposal saved', description: 'You can update the subcontractor details later from Team Management.' });
  };

  const canSave = isNewSub ? (newSubName.trim().length > 0 && selectedIds.size > 0) : (selectedSubId && selectedIds.size > 0);

  return (
    <>
      {/* Main Proposal Builder Dialog */}
      <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              Create Sub Proposal
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Sub + proposal name */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-display font-semibold">Subcontractor</Label>
                <Select value={isNewSub ? '__new__' : selectedSubId} onValueChange={handleSubChange}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Choose..." />
                  </SelectTrigger>
                  <SelectContent>
                    {assignedSubs.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.crew_name || s.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="__new__">
                      <span className="flex items-center gap-1.5">
                        <UserPlus className="w-3.5 h-3.5" />
                        Add New Subcontractor
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>

                {isNewSub && (
                  <Input
                    className="mt-2"
                    placeholder="Subcontractor name..."
                    value={newSubName}
                    onChange={e => setNewSubName(e.target.value)}
                    autoFocus
                  />
                )}
              </div>
              <div>
                <Label className="text-sm font-display font-semibold">Proposal Name</Label>
                <Input
                  className="mt-1"
                  placeholder="e.g. Phase 1 - Framing"
                  value={proposalName}
                  onChange={e => setProposalName(e.target.value)}
                />
              </div>
            </div>

            {/* Batch bid percentage */}
            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border">
              <Percent className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1">
                <Label className="text-xs font-display font-semibold">Bid Percentage of Extended Cost</Label>
                <p className="text-xs text-muted-foreground">Apply this % to all selected items' cost as the contract price</p>
              </div>
              <Input
                type="number"
                min="1"
                max="200"
                className="w-20 text-center font-display font-bold"
                value={bidPercentage}
                onChange={e => {
                  setBidPercentage(Number(e.target.value));
                  setOverrides(new Map());
                }}
              />
              <span className="text-sm font-display">%</span>
            </div>

            {/* Master budget checklist */}
            <div className="space-y-2">
              <Label className="text-sm font-display font-semibold">
                Select Line Items ({selectedIds.size} of {masterItems.length} selected)
              </Label>

              {masterItems.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No master budget items found. Import a master budget first.
                </p>
              ) : (
                <div className="space-y-4">
                  {costTypeSections.map(({ type, config, groups }) => {
                    const Icon = config.icon;
                    const allTypeItems = Array.from(groups.values()).flat();
                    const typeTotal = allTypeItems.reduce((s, i) => s + Number(i.extended_cost), 0);
                    const typeSelectedCount = allTypeItems.filter(i => selectedIds.has(i.id)).length;

                    return (
                      <div key={type} className={`border rounded-lg overflow-hidden ${config.bgColor}`}>
                        <div className="px-4 py-2.5 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Icon className={`w-4 h-4 ${config.color}`} />
                            <span className={`font-display font-bold text-sm ${config.color}`}>{config.label}</span>
                            <span className="text-xs text-muted-foreground">({allTypeItems.length} items)</span>
                          </div>
                          <div className="flex items-center gap-3">
                            {typeSelectedCount > 0 && (
                              <span className="text-xs font-display font-semibold">{typeSelectedCount} selected</span>
                            )}
                            <span className="text-xs font-display font-semibold">${typeTotal.toLocaleString()}</span>
                          </div>
                        </div>

                        <div className="bg-background/80 max-h-[30vh] overflow-y-auto">
                          {Array.from(groups.entries()).map(([group, items]) => {
                            const allGroupSelected = items.every(i => selectedIds.has(i.id));
                            const someGroupSelected = items.some(i => selectedIds.has(i.id));

                            return (
                              <div key={group}>
                                <button
                                  type="button"
                                  onClick={() => toggleGroup(items)}
                                  className="w-full flex items-center gap-2 px-4 py-2 bg-muted/40 hover:bg-muted/60 transition-colors sticky top-0 z-10 border-t border-border/50"
                                >
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

                                  return (
                                    <div key={item.id} className={`flex items-center gap-2 px-4 py-2 border-t border-border/30 ${isSelected ? 'bg-primary/5' : ''}`}>
                                      <button
                                        type="button"
                                        onClick={() => toggleItem(item.id)}
                                        className="flex items-center gap-2 flex-1 min-w-0 text-left"
                                      >
                                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                                          isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/40'
                                        }`}>
                                          {isSelected && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <span className="text-sm font-display">
                                            <span className="text-muted-foreground mr-1">#{item.line_item_no}</span>
                                            {item.cost_item_name}
                                          </span>
                                        </div>
                                        <span className="text-xs text-muted-foreground flex-shrink-0">
                                          ${Number(item.extended_cost).toLocaleString()}
                                        </span>
                                      </button>
                                      {isSelected && (
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                          <span className="text-xs text-muted-foreground">→</span>
                                          <Input
                                            type="number"
                                            className={`w-24 h-7 text-xs text-right font-display font-semibold ${hasOverride ? 'border-accent' : ''}`}
                                            value={contractPrice}
                                            onChange={e => {
                                              const val = Number(e.target.value);
                                              setOverrides(prev => {
                                                const next = new Map(prev);
                                                next.set(item.id, val);
                                                return next;
                                              });
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
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Summary */}
            {selectedIds.size > 0 && (
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <span className="font-display text-sm">{selectedIds.size} items selected</span>
                <span className="font-display font-bold text-lg">
                  Proposal Total: ${proposalTotal.toLocaleString()}
                </span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={saving || !canSave}
              className="gradient-primary text-primary-foreground"
            >
              {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
              {isNewSub ? 'Create Proposal & Add Sub' : 'Create Proposal'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Sub Details Dialog (step 2) */}
      <Dialog open={showDetailsDialog} onOpenChange={(v) => { if (!v) handleSkipDetails(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              Complete Subcontractor Profile
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            The proposal has been saved. Fill in the rest of the details to add <strong>{newSubDetails.name}</strong> to your team and subcontractor directory.
          </p>

          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-display font-semibold">Full Name</Label>
                <Input
                  className="mt-1"
                  value={newSubDetails.name}
                  onChange={e => setNewSubDetails(d => ({ ...d, name: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs font-display font-semibold">Crew Name</Label>
                <Input
                  className="mt-1"
                  placeholder="e.g. Smith Painting"
                  value={newSubDetails.crewName}
                  onChange={e => setNewSubDetails(d => ({ ...d, crewName: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-display font-semibold">Email</Label>
                <Input
                  className="mt-1"
                  type="email"
                  placeholder="sub@email.com"
                  value={newSubDetails.email}
                  onChange={e => setNewSubDetails(d => ({ ...d, email: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs font-display font-semibold">Phone</Label>
                <Input
                  className="mt-1"
                  placeholder="(555) 123-4567"
                  value={newSubDetails.phone}
                  onChange={e => setNewSubDetails(d => ({ ...d, phone: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-display font-semibold">Company Name</Label>
                <Input
                  className="mt-1"
                  placeholder="For directory listing"
                  value={newSubDetails.companyName}
                  onChange={e => setNewSubDetails(d => ({ ...d, companyName: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs font-display font-semibold">Location</Label>
                <Input
                  className="mt-1"
                  placeholder="City, State"
                  value={newSubDetails.location}
                  onChange={e => setNewSubDetails(d => ({ ...d, location: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs font-display font-semibold">Specialties <span className="text-muted-foreground font-normal">(comma-separated)</span></Label>
              <Input
                className="mt-1"
                placeholder="e.g. Painting, Drywall, Finishing"
                value={newSubDetails.specialties}
                onChange={e => setNewSubDetails(d => ({ ...d, specialties: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs font-display font-semibold">Notes</Label>
              <Textarea
                className="mt-1"
                placeholder="Any notes about this subcontractor..."
                rows={2}
                value={newSubDetails.notes}
                onChange={e => setNewSubDetails(d => ({ ...d, notes: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={handleSkipDetails}>Skip for now</Button>
            <Button onClick={handleSaveDetails} disabled={savingDetails} className="gradient-primary text-primary-foreground">
              {savingDetails ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <UserPlus className="w-4 h-4 mr-1" />}
              Save Details
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SubProposalBuilder;
