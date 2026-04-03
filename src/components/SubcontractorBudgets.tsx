import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronDown, HardHat, Loader2, Trash2, Plus, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useSubBudgets, useSubBudgetLineItems, useDeleteSubBudget } from '@/hooks/useProjects';
import type { DbTeamMember } from '@/hooks/useProjects';
import SubProposalBuilder from './SubProposalBuilder';

interface SubcontractorBudgetsProps {
  projectId: string;
  assignedMembers: DbTeamMember[];
  currentUserId: string;
}

const SubcontractorBudgets: React.FC<SubcontractorBudgetsProps> = ({
  projectId,
  assignedMembers,
  currentUserId,
}) => {
  const { data: subBudgets = [] } = useSubBudgets(projectId);
  const [expanded, setExpanded] = useState(false);
  const [viewingBudgetId, setViewingBudgetId] = useState<string | null>(null);
  const [proposalOpen, setProposalOpen] = useState(false);

  const subs = assignedMembers.filter(m => m.role === 'subcontractor');

  return (
    <div className="card-elevated p-5 space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 font-display font-semibold text-lg hover:text-primary transition-colors"
        >
          {expanded ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
          <HardHat className="w-5 h-5 text-muted-foreground" />
          Subcontractor Budgets
          <span className="text-sm font-normal text-muted-foreground">({subBudgets.length} proposals)</span>
        </button>
        <Button variant="outline" size="sm" onClick={() => setProposalOpen(true)} className="text-xs font-display">
          <Plus className="w-3 h-3 mr-1" /> Create Proposal
        </Button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            {subBudgets.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No proposals created yet. Create one from the master budget.</p>
            ) : (
              <div className="space-y-3">
                {subBudgets.map((sb: any) => (
                  <SubBudgetRow
                    key={sb.id}
                    subBudget={sb}
                    isExpanded={viewingBudgetId === sb.id}
                    onToggle={() => setViewingBudgetId(prev => prev === sb.id ? null : sb.id)}
                    projectId={projectId}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <SubProposalBuilder
        open={proposalOpen}
        onOpenChange={setProposalOpen}
        projectId={projectId}
        currentUserId={currentUserId}
        assignedSubs={subs}
      />
    </div>
  );
};

// Sub-component to show individual proposal with expandable line items
const SubBudgetRow: React.FC<{
  subBudget: any;
  isExpanded: boolean;
  onToggle: () => void;
  projectId: string;
}> = ({ subBudget, isExpanded, onToggle, projectId }) => {
  const { data: lineItems = [] } = useSubBudgetLineItems(isExpanded ? subBudget.id : undefined);
  const { toast } = useToast();
  const deleteSubBudget = useDeleteSubBudget();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const sub = subBudget.team_members;
  const contractTotal = lineItems.reduce((s: number, i: any) => s + Number(i.contract_price || i.extended_cost), 0);
  const costTotal = lineItems.reduce((s: number, i: any) => s + Number(i.extended_cost), 0);
  const proposalLabel = subBudget.proposal_name || subBudget.file_name || 'Proposal';

  const handleDelete = async () => {
    try {
      await deleteSubBudget.mutateAsync({ subBudgetId: subBudget.id, projectId });
      toast({ title: 'Proposal deleted', description: `Proposal for ${sub?.name || 'team member'} has been removed.` });
      setConfirmDelete(false);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors">
        <button onClick={onToggle} className="flex items-center gap-3 flex-1 text-left">
          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-display font-bold">
            {sub?.name?.[0] || '?'}
          </div>
          <div>
            <p className="font-display font-medium text-sm">{sub?.crew_name || sub?.name || 'Unknown'}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <FileSpreadsheet className="w-3 h-3" />
              {proposalLabel}
              {subBudget.bid_percentage && subBudget.bid_percentage !== 100 && (
                <span className="ml-1 text-primary font-semibold">({subBudget.bid_percentage}%)</span>
              )}
            </p>
          </div>
        </button>
        <div className="flex items-center gap-2">
          <span className="font-display font-semibold text-sm">
            {isExpanded ? `$${contractTotal.toLocaleString()}` : ''}
          </span>
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <Button variant="destructive" size="sm" className="text-xs h-7" onClick={handleDelete} disabled={deleteSubBudget.isPending}>
                {deleteSubBudget.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Confirm'}
              </Button>
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            </div>
          ) : (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
          <button onClick={onToggle}>
            {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && lineItems.length > 0 && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="border-t border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">#</TableHead>
                    <TableHead className="text-xs">Item</TableHead>
                    <TableHead className="text-xs">Group</TableHead>
                    <TableHead className="text-xs text-right">Cost</TableHead>
                    <TableHead className="text-xs text-right">Contract</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineItems.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-xs text-muted-foreground">{item.line_item_no}</TableCell>
                      <TableCell className="text-xs">{item.cost_item_name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-[150px]">{item.cost_group}</TableCell>
                      <TableCell className="text-xs text-right text-muted-foreground">${Number(item.extended_cost).toLocaleString()}</TableCell>
                      <TableCell className="text-xs text-right font-display font-semibold">${Number(item.contract_price || item.extended_cost).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="border-t border-border p-3 bg-muted/50 flex justify-between text-sm">
                <span className="text-muted-foreground">Totals</span>
                <div className="flex gap-4">
                  <span className="text-muted-foreground">Cost: ${costTotal.toLocaleString()}</span>
                  <span className="font-display font-bold">Contract: ${contractTotal.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SubcontractorBudgets;
