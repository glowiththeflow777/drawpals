import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronDown, HardHat, Loader2, Trash2, Plus, FileSpreadsheet, Download, FileText, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useSubBudgets, useSubBudgetLineItems, useDeleteSubBudget } from '@/hooks/useProjects';
import type { DbTeamMember } from '@/hooks/useProjects';
import SubProposalBuilder, { type EditProposalData } from './SubProposalBuilder';

interface SubcontractorBudgetsProps {
  projectId: string;
  projectName: string;
  assignedMembers: DbTeamMember[];
  currentUserId: string;
}

const SubcontractorBudgets: React.FC<SubcontractorBudgetsProps> = ({
  projectId,
  projectName,
  assignedMembers,
  currentUserId,
}) => {
  const { data: subBudgets = [] } = useSubBudgets(projectId);
  const [expanded, setExpanded] = useState(false);
  const [viewingBudgetId, setViewingBudgetId] = useState<string | null>(null);
  const [proposalOpen, setProposalOpen] = useState(false);
  const [editData, setEditData] = useState<EditProposalData | null>(null);

  const subs = assignedMembers.filter(m => m.role === 'subcontractor');

  const handleEdit = (sb: any, lineItems: any[]) => {
    setEditData({
      id: sb.id,
      team_member_id: sb.team_member_id || sb.team_members?.id,
      proposal_name: sb.proposal_name || '',
      bid_percentage: sb.bid_percentage || 60,
      file_name: sb.file_name || '',
      lineItems,
    });
    setProposalOpen(true);
  };

  const handleClose = (open: boolean) => {
    setProposalOpen(open);
    if (!open) setEditData(null);
  };

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
          Subcontractor Proposals
          <span className="text-sm font-normal text-muted-foreground">({subBudgets.length})</span>
        </button>
        <Button variant="outline" size="sm" onClick={() => { setEditData(null); setProposalOpen(true); }} className="text-xs font-display">
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
                    projectName={projectName}
                    onEdit={handleEdit}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <SubProposalBuilder
        open={proposalOpen}
        onOpenChange={handleClose}
        projectId={projectId}
        currentUserId={currentUserId}
        assignedSubs={subs}
        editData={editData}
      />
    </div>
  );
};

function buildFileName(projectName: string, subName: string, proposalLabel: string) {
  return `${projectName} - ${subName} - ${proposalLabel}`.replace(/[/\\?%*:|"<>]/g, '_');
}

const SubBudgetRow: React.FC<{
  subBudget: any;
  isExpanded: boolean;
  onToggle: () => void;
  projectId: string;
  projectName: string;
  onEdit: (sb: any, lineItems: any[]) => void;
}> = ({ subBudget, isExpanded, onToggle, projectId, projectName, onEdit }) => {
  const { data: lineItems = [] } = useSubBudgetLineItems(subBudget.id);
  const { toast } = useToast();
  const deleteSubBudget = useDeleteSubBudget();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const sub = subBudget.team_members;
  const contractTotal = lineItems.reduce((s: number, i: any) => s + Number(i.contract_price || i.extended_cost), 0);
  const costTotal = lineItems.reduce((s: number, i: any) => s + Number(i.extended_cost), 0);
  const proposalLabel = subBudget.proposal_name || subBudget.file_name || 'Proposal';
  const subName = sub?.crew_name || sub?.name || 'Unknown';
  const fileName = buildFileName(projectName, subName, proposalLabel);

  const handleDownloadCSV = () => {
    if (lineItems.length === 0) {
      toast({ title: 'No data', description: 'No line items found for this proposal.' });
      return;
    }
    const headers = ['#', 'Cost Item Name', 'Cost Group', 'Cost Code', 'Cost Type', 'Quantity', 'Unit', 'Cost', 'Contract Price'];
    const rows = lineItems.map((item: any) => [
      item.line_item_no,
      `"${(item.cost_item_name || '').replace(/"/g, '""')}"`,
      `"${(item.cost_group || '').replace(/"/g, '""')}"`,
      `"${(item.cost_code || '').replace(/"/g, '""')}"`,
      `"${(item.cost_type || '').replace(/"/g, '""')}"`,
      item.quantity,
      `"${(item.unit || '').replace(/"/g, '""')}"`,
      Number(item.extended_cost),
      Number(item.contract_price || item.extended_cost),
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    triggerDownload(blob, `${fileName}.csv`);
  };

  const handleDownloadPDF = () => {
    if (lineItems.length === 0) {
      toast({ title: 'No data', description: 'No line items found for this proposal.' });
      return;
    }

    const htmlRows = lineItems.map((item: any) => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:12px">${item.line_item_no}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:12px">${item.cost_item_name || ''}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:12px">${item.cost_group || ''}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:12px">${item.cost_code || ''}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:12px">${item.cost_type || ''}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:12px">${item.quantity}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:12px">${item.unit || ''}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:12px">$${Number(item.extended_cost).toLocaleString()}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;font-size:12px">$${Number(item.contract_price || item.extended_cost).toLocaleString()}</td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html><head>
        <title>${fileName}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; color: #1a1a1a; }
          h1 { font-size: 20px; margin-bottom: 4px; }
          .meta { color: #666; font-size: 13px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; }
          th { padding: 8px; border-bottom: 2px solid #333; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #555; }
          th:nth-child(6), th:nth-child(8), th:nth-child(9) { text-align: right; }
          .totals { margin-top: 16px; text-align: right; font-size: 14px; }
          .totals .label { color: #666; }
          .totals .value { font-weight: 700; margin-left: 8px; }
          @media print { body { margin: 20px; } }
        </style>
      </head><body>
        <h1>${proposalLabel}</h1>
        <div class="meta">
          <strong>Project:</strong> ${projectName} &nbsp;|&nbsp;
          <strong>Subcontractor:</strong> ${subName}
          
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th><th>Cost Item</th><th>Group</th><th>Code</th><th>Type</th><th style="text-align:center">Qty</th><th>Unit</th><th style="text-align:right">Cost</th><th style="text-align:right">Contract</th>
            </tr>
          </thead>
          <tbody>${htmlRows}</tbody>
        </table>
        <div class="totals">
          <span class="label">Total Cost:</span><span class="value">$${costTotal.toLocaleString()}</span>
          &nbsp;&nbsp;&nbsp;
          <span class="label">Total Contract:</span><span class="value">$${contractTotal.toLocaleString()}</span>
        </div>
        <script>window.onload=function(){window.print()}</script>
      </body></html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    }
  };

  const handleDelete = async () => {
    try {
      await deleteSubBudget.mutateAsync({ subBudgetId: subBudget.id, projectId });
      toast({ title: 'Proposal deleted', description: `Proposal for ${subName} has been removed.` });
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
            <p className="font-display font-medium text-sm">{subName}</p>
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
          <span className="font-display font-semibold text-sm text-primary">
            ${contractTotal.toLocaleString()}
          </span>
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <Button variant="destructive" size="sm" className="text-xs h-7" onClick={handleDelete} disabled={deleteSubBudget.isPending}>
                {deleteSubBudget.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Confirm'}
              </Button>
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            </div>
          ) : (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-primary"
                title="Edit proposal"
                onClick={() => onEdit(subBudget, lineItems)}
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" title="Download">
                    <Download className="w-3.5 h-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleDownloadCSV} className="text-xs gap-2">
                    <FileSpreadsheet className="w-3.5 h-3.5" /> Download CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDownloadPDF} className="text-xs gap-2">
                    <FileText className="w-3.5 h-3.5" /> Download PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </>
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

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default SubcontractorBudgets;
