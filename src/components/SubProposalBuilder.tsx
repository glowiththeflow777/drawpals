import React, { useState, useMemo } from 'react';
import { Check, Loader2, FileSpreadsheet, Percent } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
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
  const [proposalName, setProposalName] = useState('');
  const [bidPercentage, setBidPercentage] = useState(60);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [overrides, setOverrides] = useState<Map<string, number>>(new Map());
  const [saving, setSaving] = useState(false);

  // Group master items by cost group
  const groups = useMemo(() => {
    const map = new Map<string, typeof masterItems>();
    masterItems.forEach(item => {
      const group = item.cost_group || 'Ungrouped';
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push(item);
    });
    return map;
  }, [masterItems]);

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
    setProposalName('');
    setBidPercentage(60);
    setSelectedIds(new Set());
    setOverrides(new Map());
  };

  const handleSave = async () => {
    if (!selectedSubId || selectedIds.size === 0) return;
    setSaving(true);
    try {
      // Create sub_budget (proposal)
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

      const budgetId = (budget as any).id;

      // Insert line items with contract prices
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

      const subName = assignedSubs.find(s => s.id === selectedSubId)?.crew_name ||
                      assignedSubs.find(s => s.id === selectedSubId)?.name || 'team member';

      toast({
        title: 'Proposal created',
        description: `${selectedItems.length} items assigned to ${subName} — $${proposalTotal.toLocaleString()} total.`,
      });

      qc.invalidateQueries({ queryKey: ['sub_budgets', projectId] });
      qc.invalidateQueries({ queryKey: ['sub_budget_line_items'] });
      qc.invalidateQueries({ queryKey: ['sub_bid_total', projectId] });
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
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
              <Select value={selectedSubId} onValueChange={setSelectedSubId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choose..." />
                </SelectTrigger>
                <SelectContent>
                  {assignedSubs.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.crew_name || s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                setOverrides(new Map()); // Clear overrides when changing %
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
              <div className="border border-border rounded-lg overflow-hidden max-h-[40vh] overflow-y-auto">
                {Array.from(groups.entries()).map(([group, items]) => {
                  const allGroupSelected = items.every(i => selectedIds.has(i.id));
                  const someGroupSelected = items.some(i => selectedIds.has(i.id));

                  return (
                    <div key={group}>
                      <button
                        type="button"
                        onClick={() => toggleGroup(items)}
                        className="w-full flex items-center gap-2 px-4 py-2 bg-muted/40 hover:bg-muted/60 transition-colors sticky top-0 z-10"
                      >
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                          allGroupSelected ? 'border-primary bg-primary' : someGroupSelected ? 'border-primary bg-primary/30' : 'border-muted-foreground/40'
                        }`}>
                          {allGroupSelected && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                        </div>
                        <span className="font-display font-semibold text-xs flex-1 text-left">{group}</span>
                        <span className="text-xs text-muted-foreground">{items.length} items</span>
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
            disabled={saving || !selectedSubId || selectedIds.size === 0}
            className="gradient-primary text-primary-foreground"
          >
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
            Create Proposal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SubProposalBuilder;
