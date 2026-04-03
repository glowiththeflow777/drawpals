import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, DollarSign, FileText, CheckCircle2, Wallet, TrendingUp, ChevronRight, ChevronDown, Layers, PiggyBank, Award, Building2, UserCheck, Calculator, HardHat, ClipboardCheck } from 'lucide-react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useProjects, useBudgetLineItems, useBillingHistory, useInvoiceLineItemsDetailed, useInvoices, usePmDrawPaymentsForProject, useSubBidTotal, useSubBudgets, useSubBudgetLineItems } from '@/hooks/useProjects';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

type Section = 'budget' | 'invoiced' | 'approved' | 'remaining' | 'sub_budget' | 'proposals';

const ProjectFinancials = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { data: projects = [] } = useProjects();
  const { data: budgetItems = [] } = useBudgetLineItems(projectId);
  const { data: billingHistory = new Map() } = useBillingHistory(projectId);
  const { data: invoiceLineItems = [] } = useInvoiceLineItemsDetailed(projectId);
  const { data: invoices = [] } = useInvoices(projectId);
  const { data: pmFeeCollected = 0 } = usePmDrawPaymentsForProject(projectId);
  const { data: computedSubTotals } = useSubBidTotal(projectId);
  const computedSubBudgetTotal = computedSubTotals?.costTotal ?? 0;
  const computedProposalTotal = computedSubTotals?.contractTotal ?? 0;
  const { data: subBudgets = [] } = useSubBudgets(projectId);

  // Fetch all sub budget line items for this project in one query
  const { data: allSubLineItems = [] } = useQuery({
    queryKey: ['all_sub_budget_line_items', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data: budgets } = await supabase
        .from('sub_budgets')
        .select('id, proposal_name, team_member_id, bid_percentage, team_members(name, crew_name)')
        .eq('project_id', projectId!);
      if (!budgets || budgets.length === 0) return [];
      const budgetIds = budgets.map(b => b.id);
      const { data: items } = await supabase
        .from('sub_budget_line_items')
        .select('*')
        .in('sub_budget_id', budgetIds);
      // Attach budget metadata to each item
      return (items || []).map(item => {
        const budget = budgets.find(b => b.id === item.sub_budget_id);
        return {
          ...item,
          sub_name: (budget as any)?.team_members?.crew_name || (budget as any)?.team_members?.name || 'Unknown',
          proposal_name: budget?.proposal_name || 'Proposal',
          bid_percentage: budget?.bid_percentage || 100,
        };
      });
    },
  });

  const project = projects.find(p => p.id === projectId);

  const totalBudget = Number(project?.total_budget || 0);
  const masterBudget = Number((project as any)?.master_budget || 0) || totalBudget;
  const pmFeeRate = Number((project as any)?.pm_fee_rate ?? 0.10);
  const subBidTotal = computedSubBudgetTotal; // Internal cost from master budget items
  const proposalTotal = computedProposalTotal; // What subs are actually contracted for
  const actualSubPaid = Number((project as any)?.actual_sub_paid || 0) || Number(project?.amount_paid || 0);
  const invoiced = Number(project?.amount_invoiced || 0);
  const approved = Number(project?.amount_paid || 0);
  const remaining = totalBudget - invoiced;

  // Derived financial metrics
  const budgetRemaining = masterBudget - subBidTotal;
  const savings = masterBudget - actualSubPaid;
  const pmSavingsBonus = savings > 0 ? savings * 0.30 : 0;
  const businessShare = savings > 0 ? savings * 0.70 : 0;
  const pmCoordinationFee = masterBudget * pmFeeRate;
  const pmFeeRemaining = pmCoordinationFee - pmFeeCollected;

  const stats: { key: Section; label: string; value: number; icon: React.ElementType; color: string }[] = [
    { key: 'budget', label: 'Total Budget', value: totalBudget, icon: Wallet, color: 'text-primary' },
    { key: 'invoiced', label: 'Invoiced', value: invoiced, icon: FileText, color: 'text-amber-600' },
    { key: 'approved', label: 'Approved', value: approved, icon: CheckCircle2, color: 'text-emerald-600' },
    { key: 'remaining', label: 'Remaining', value: remaining, icon: TrendingUp, color: 'text-sky-600' },
  ];

  const [activeSection, setActiveSection] = useState<Section | null>(null);

  // Group budget items by cost_group
  const groupByCostGroup = (items: any[]) => {
    const groups: Record<string, any[]> = {};
    items.forEach(item => {
      const group = item.cost_group || 'Ungrouped';
      if (!groups[group]) groups[group] = [];
      groups[group].push(item);
    });
    return groups;
  };

  // Aggregate invoice line items by budget_line_item_id
  const aggregateByBudgetItem = (items: any[]) => {
    const map = new Map<string, { totalDrawn: number; count: number; invoiceIds: Set<string> }>();
    items.forEach((ili: any) => {
      const key = ili.budget_line_item_id;
      const existing = map.get(key) || { totalDrawn: 0, count: 0, invoiceIds: new Set<string>() };
      existing.totalDrawn += Number(ili.draw_amount);
      existing.count += 1;
      existing.invoiceIds.add(ili.invoice_id);
      map.set(key, existing);
    });
    return map;
  };

  // Get invoices by status
  const getInvoicesByStatus = (status?: string) => {
    if (!status) return invoices.filter((inv: any) => inv.status !== 'rejected');
    return invoices.filter((inv: any) => inv.status === status);
  };

  // Get invoice line items by status
  const getFilteredInvoiceItems = (status?: string) => {
    if (!status) return invoiceLineItems.filter((ili: any) => ili.invoices?.status !== 'rejected');
    return invoiceLineItems.filter((ili: any) => ili.invoices?.status === status);
  };

  const renderBudgetSection = () => {
    const groups = groupByCostGroup(budgetItems);
    return (
      <div className="space-y-4">
        <Accordion type="multiple" className="space-y-2">
          {Object.entries(groups).map(([group, items]) => {
            const groupTotal = items.reduce((s: number, i: any) => s + Number(i.extended_cost), 0);
            return (
              <AccordionItem key={group} value={group} className="border border-border rounded-lg overflow-hidden">
                <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30">
                  <div className="flex items-center justify-between w-full pr-2">
                    <span className="font-display font-semibold">{group}</span>
                    <span className="font-display font-bold">${groupTotal.toLocaleString()}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-0 pb-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">#</TableHead>
                        <TableHead className="text-xs">Item</TableHead>
                        <TableHead className="text-xs">Type</TableHead>
                        <TableHead className="text-xs text-right">Qty</TableHead>
                        <TableHead className="text-xs text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-muted-foreground">{item.line_item_no}</TableCell>
                          <TableCell>
                            <p className="font-medium text-sm">{item.cost_item_name}</p>
                            {item.description && item.description !== item.cost_item_name && (
                              <p className="text-xs text-muted-foreground">{item.description}</p>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="px-1.5 py-0.5 rounded text-xs bg-muted text-muted-foreground">{item.cost_type}</span>
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">{Number(item.quantity)} {item.unit}</TableCell>
                          <TableCell className="text-right font-display font-semibold">${Number(item.extended_cost).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
        <div className="flex justify-between items-center px-4 py-3 card-elevated">
          <span className="font-display font-bold text-lg">Grand Total</span>
          <span className="font-display font-bold text-xl">${totalBudget.toLocaleString()}</span>
        </div>
      </div>
    );
  };

  const renderInvoiceSection = (statusFilter?: string) => {
    const relevantInvoices = getInvoicesByStatus(statusFilter);
    const filtered = getFilteredInvoiceItems(statusFilter);
    const aggregated = aggregateByBudgetItem(filtered);
    const totalDrawn = Array.from(aggregated.values()).reduce((s, v) => s + v.totalDrawn, 0);
    const statusLabel = statusFilter === 'approved' ? 'Approved' : 'Invoiced';

    if (relevantInvoices.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No {statusLabel.toLowerCase()} items yet.</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Per-invoice breakdown */}
        <Accordion type="multiple" className="space-y-2">
          {relevantInvoices.map((inv: any) => {
            const invLineItems = filtered.filter((ili: any) => ili.invoice_id === inv.id);
            const invTotal = invLineItems.reduce((s: number, ili: any) => s + Number(ili.draw_amount), 0);
            return (
              <AccordionItem key={inv.id} value={inv.id} className="border border-border rounded-lg overflow-hidden">
                <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30">
                  <div className="flex items-center justify-between w-full pr-2">
                    <div className="text-left">
                      <span className="font-display font-semibold">{inv.invoice_number || 'Invoice'}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {inv.subcontractor_name} · {new Date(inv.invoice_date).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                        inv.status === 'approved' ? 'status-badge-approved' :
                        inv.status === 'submitted' ? 'bg-amber-500/10 text-amber-600' :
                        inv.status === 'rejected' ? 'bg-destructive/10 text-destructive' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {inv.status}
                      </span>
                      <span className="font-display font-bold">${(invTotal || Number(inv.grand_total)).toLocaleString()}</span>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-0 pb-0">
                  {invLineItems.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">#</TableHead>
                          <TableHead className="text-xs">Description</TableHead>
                          <TableHead className="text-xs text-right">Contract Price</TableHead>
                          <TableHead className="text-xs text-right">% Complete</TableHead>
                          <TableHead className="text-xs text-right">Draw Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invLineItems.map((ili: any) => (
                          <TableRow key={ili.id}>
                            <TableCell className="text-muted-foreground">{ili.line_item_no}</TableCell>
                            <TableCell className="text-sm">{ili.description}</TableCell>
                            <TableCell className="text-right text-muted-foreground">${Number(ili.contract_price).toLocaleString()}</TableCell>
                            <TableCell className="text-right text-muted-foreground">{Number(ili.percent_complete)}%</TableCell>
                            <TableCell className="text-right font-display font-semibold">${Number(ili.draw_amount).toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="px-4 py-4 text-sm text-muted-foreground">
                      <p>SOW: ${Number(inv.sow_total).toLocaleString()}</p>
                      {Number(inv.day_labor_total) > 0 && <p>Day Labor: ${Number(inv.day_labor_total).toLocaleString()}</p>}
                      {Number(inv.reimbursement_total) > 0 && <p>Reimbursements: ${Number(inv.reimbursement_total).toLocaleString()}</p>}
                      {Number(inv.change_order_total) > 0 && <p>Change Orders: ${Number(inv.change_order_total).toLocaleString()}</p>}
                      <p className="font-display font-semibold mt-2">Total: ${Number(inv.grand_total).toLocaleString()}</p>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>

        {/* Per-line-item aggregate summary */}
        {aggregated.size > 0 && (
          <div className="card-elevated p-4 space-y-3">
            <h4 className="text-sm font-display font-semibold text-muted-foreground uppercase tracking-wide">
              Summary by Line Item
            </h4>
            {Object.entries(groupByCostGroup(budgetItems)).map(([group, items]) => {
              const groupItems = items.filter((i: any) => aggregated.has(i.id));
              if (groupItems.length === 0) return null;
              return (
                <div key={group} className="space-y-1">
                  <p className="text-xs font-display font-semibold text-muted-foreground">{group}</p>
                  {groupItems.map((item: any) => {
                    const agg = aggregated.get(item.id)!;
                    const budget = Number(item.extended_cost);
                    const pct = budget > 0 ? Math.round((agg.totalDrawn / budget) * 100) : 0;
                    return (
                      <div key={item.id} className="flex items-center justify-between gap-4 py-1">
                        <span className="text-sm truncate flex-1">{item.cost_item_name}</span>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <Progress value={Math.min(100, pct)} className="w-20 h-1.5" />
                          <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
                          <span className="font-display font-semibold text-sm w-24 text-right">${agg.totalDrawn.toLocaleString()}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-between items-center px-4 py-3 card-elevated">
          <span className="font-display font-bold text-lg">Total {statusLabel}</span>
          <span className="font-display font-bold text-xl">${totalDrawn.toLocaleString()}</span>
        </div>
      </div>
    );
  };

  const renderRemainingSection = () => {
    const groups = groupByCostGroup(budgetItems);
    return (
      <div className="space-y-4">
        <Accordion type="multiple" className="space-y-2">
          {Object.entries(groups).map(([group, items]) => {
            const groupBudget = items.reduce((s: number, i: any) => s + Number(i.extended_cost), 0);
            const groupBilled = items.reduce((s: number, i: any) => s + (billingHistory.get(i.id) || 0), 0);
            const groupRemaining = groupBudget - groupBilled;
            const groupPct = groupBudget > 0 ? Math.round((groupBilled / groupBudget) * 100) : 0;
            return (
              <AccordionItem key={group} value={group} className="border border-border rounded-lg overflow-hidden">
                <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30">
                  <div className="flex items-center justify-between w-full pr-2">
                    <div className="flex items-center gap-3">
                      <span className="font-display font-semibold">{group}</span>
                      <Progress value={Math.min(100, groupPct)} className="w-20 h-1.5" />
                      <span className="text-xs text-muted-foreground">{groupPct}% used</span>
                    </div>
                    <span className="font-display font-bold">${groupRemaining.toLocaleString()}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-0 pb-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">#</TableHead>
                        <TableHead className="text-xs">Item</TableHead>
                        <TableHead className="text-xs text-right">Budget</TableHead>
                        <TableHead className="text-xs text-right">Billed</TableHead>
                        <TableHead className="text-xs text-right">Remaining</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item: any) => {
                        const budget = Number(item.extended_cost);
                        const billed = billingHistory.get(item.id) || 0;
                        const rem = Math.max(0, budget - billed);
                        const pct = budget > 0 ? Math.round((billed / budget) * 100) : 0;
                        return (
                          <TableRow key={item.id}>
                            <TableCell className="text-muted-foreground">{item.line_item_no}</TableCell>
                            <TableCell className="text-sm font-medium">{item.cost_item_name}</TableCell>
                            <TableCell className="text-right text-muted-foreground">${budget.toLocaleString()}</TableCell>
                            <TableCell className="text-right text-muted-foreground">${billed.toLocaleString()}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center gap-2 justify-end">
                                <span className={`font-display font-semibold ${rem === 0 ? 'text-muted-foreground' : ''}`}>
                                  ${rem.toLocaleString()}
                                </span>
                                <Progress value={Math.min(100, pct)} className="w-12 h-1.5" />
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
        <div className="flex justify-between items-center px-4 py-3 card-elevated">
          <span className="font-display font-bold text-lg">Total Remaining</span>
          <span className="font-display font-bold text-xl">${remaining.toLocaleString()}</span>
        </div>
      </div>
    );
  };

  // Sub Budget Breakdown — same view as master budget, grouped by cost_group, showing extended_cost
  const renderSubBudgetBreakdown = () => {
    if (allSubLineItems.length === 0) {
      return <p className="text-sm text-muted-foreground text-center py-6">No subcontractor budgets created yet.</p>;
    }
    const groups = groupByCostGroup(allSubLineItems);
    return (
      <div className="space-y-4">
        <Accordion type="multiple" className="space-y-2">
          {Object.entries(groups).map(([group, items]) => {
            const groupTotal = items.reduce((s: number, i: any) => s + Number(i.extended_cost), 0);
            return (
              <AccordionItem key={group} value={group} className="border border-border rounded-lg overflow-hidden">
                <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30">
                  <div className="flex items-center justify-between w-full pr-2">
                    <span className="font-display font-semibold">{group}</span>
                    <span className="font-display font-bold">${groupTotal.toLocaleString()}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-0 pb-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">#</TableHead>
                        <TableHead className="text-xs">Item</TableHead>
                        <TableHead className="text-xs">Type</TableHead>
                        <TableHead className="text-xs">Sub</TableHead>
                        <TableHead className="text-xs text-right">Qty</TableHead>
                        <TableHead className="text-xs text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-muted-foreground">{item.line_item_no}</TableCell>
                          <TableCell>
                            <p className="font-medium text-sm">{item.cost_item_name}</p>
                            {item.description && item.description !== item.cost_item_name && (
                              <p className="text-xs text-muted-foreground">{item.description}</p>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="px-1.5 py-0.5 rounded text-xs bg-muted text-muted-foreground">{item.cost_type}</span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{item.sub_name}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{Number(item.quantity)} {item.unit}</TableCell>
                          <TableCell className="text-right font-display font-semibold">${Number(item.extended_cost).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
        <div className="flex justify-between items-center px-4 py-3 card-elevated">
          <span className="font-display font-bold text-lg">Sub Budget Total</span>
          <span className="font-display font-bold text-xl">${computedSubBudgetTotal.toLocaleString()}</span>
        </div>
      </div>
    );
  };

  // Proposal Breakdown — same view as master budget, grouped by cost_group, showing contract_price
  const renderProposalBreakdown = () => {
    if (allSubLineItems.length === 0) {
      return <p className="text-sm text-muted-foreground text-center py-6">No proposals created yet.</p>;
    }
    const groups = groupByCostGroup(allSubLineItems);
    return (
      <div className="space-y-4">
        <Accordion type="multiple" className="space-y-2">
          {Object.entries(groups).map(([group, items]) => {
            const groupContractTotal = items.reduce((s: number, i: any) => s + Number(i.contract_price || i.extended_cost), 0);
            return (
              <AccordionItem key={group} value={group} className="border border-border rounded-lg overflow-hidden">
                <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30">
                  <div className="flex items-center justify-between w-full pr-2">
                    <span className="font-display font-semibold">{group}</span>
                    <span className="font-display font-bold">${groupContractTotal.toLocaleString()}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-0 pb-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">#</TableHead>
                        <TableHead className="text-xs">Item</TableHead>
                        <TableHead className="text-xs">Type</TableHead>
                        <TableHead className="text-xs">Sub</TableHead>
                        <TableHead className="text-xs text-right">Cost</TableHead>
                        <TableHead className="text-xs text-right">Contract Price</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-muted-foreground">{item.line_item_no}</TableCell>
                          <TableCell>
                            <p className="font-medium text-sm">{item.cost_item_name}</p>
                            {item.description && item.description !== item.cost_item_name && (
                              <p className="text-xs text-muted-foreground">{item.description}</p>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="px-1.5 py-0.5 rounded text-xs bg-muted text-muted-foreground">{item.cost_type}</span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{item.sub_name}</TableCell>
                          <TableCell className="text-right text-muted-foreground">${Number(item.extended_cost).toLocaleString()}</TableCell>
                          <TableCell className="text-right font-display font-semibold">${Number(item.contract_price || item.extended_cost).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
        <div className="flex justify-between items-center px-4 py-3 card-elevated">
          <span className="font-display font-bold text-lg">Proposal Total</span>
          <span className="font-display font-bold text-xl">${computedProposalTotal.toLocaleString()}</span>
        </div>
      </div>
    );
  };

  const sections: { key: Section; title: string; icon: React.ElementType; color: string; render: () => React.ReactNode }[] = [
    { key: 'budget', title: 'Master Budget', icon: Wallet, color: 'text-primary', render: renderBudgetSection },
    { key: 'sub_budget', title: 'Subcontractor Budget', icon: HardHat, color: 'text-amber-600', render: renderSubBudgetBreakdown },
    { key: 'proposals', title: 'Subcontractor Proposals', icon: ClipboardCheck, color: 'text-violet-600', render: renderProposalBreakdown },
    { key: 'invoiced', title: 'Invoiced Breakdown', icon: FileText, color: 'text-amber-600', render: () => renderInvoiceSection() },
    { key: 'approved', title: 'Approved Breakdown', icon: CheckCircle2, color: 'text-emerald-600', render: () => renderInvoiceSection('approved') },
    { key: 'remaining', title: 'Remaining Budget', icon: TrendingUp, color: 'text-sky-600', render: renderRemainingSection },
  ];

  if (!project) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-6">
        <p className="text-muted-foreground">Project not found.</p>
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <button
        onClick={() => navigate('/admin/projects')}
        className="text-muted-foreground text-sm hover:text-foreground transition-colors flex items-center gap-1"
      >
        <ArrowLeft className="w-4 h-4" /> Back to {project.name}
      </button>

      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <DollarSign className="w-6 h-6 text-primary" />
          Financial Dashboard
        </h1>
        <p className="text-muted-foreground font-body">{project.name} · {project.address}</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map(stat => (
          <button
            key={stat.key}
            onClick={() => setActiveSection(prev => prev === stat.key ? null : stat.key)}
            className={`card-elevated p-4 text-left transition-all hover:shadow-md ${
              activeSection === stat.key ? 'ring-2 ring-primary shadow-md' : ''
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
              <p className="text-xs text-muted-foreground font-body">{stat.label}</p>
            </div>
            <p className="text-xl font-display font-bold">${stat.value.toLocaleString()}</p>
            {stat.key !== 'budget' && totalBudget > 0 && (
              <div className="mt-2">
                <Progress value={Math.min(100, (stat.value / totalBudget) * 100)} className="h-1.5" />
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Budget Layers Overview */}
      <div className="card-elevated p-5 space-y-4">
        <h2 className="text-sm font-display font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <Layers className="w-4 h-4" />
          Budget Layers & PM Financials
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Master Budget', value: masterBudget, icon: Building2, color: 'text-primary' },
            { label: 'Sub Budget', value: subBidTotal, icon: FileText, color: 'text-amber-600', subtitle: 'Internal cost' },
            { label: 'Proposal Total', value: proposalTotal, icon: UserCheck, color: 'text-violet-600', subtitle: 'Contracted' },
            { label: 'Budget Remaining', value: budgetRemaining, icon: TrendingUp, color: 'text-sky-600' },
            { label: 'Actual Sub Paid', value: actualSubPaid, icon: CheckCircle2, color: 'text-emerald-600' },
            { label: 'Savings', value: savings, icon: PiggyBank, color: savings > 0 ? 'text-emerald-600' : 'text-destructive' },
          ].map(item => (
            <div key={item.label} className="bg-muted/30 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <item.icon className={`w-3.5 h-3.5 ${item.color}`} />
                <p className="text-xs text-muted-foreground font-body">{item.label}</p>
              </div>
              <p className="text-lg font-display font-bold">${item.value.toLocaleString()}</p>
            </div>
          ))}
        </div>
        <div className="border-t border-border pt-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { label: 'PM Savings Bonus (30%)', value: pmSavingsBonus, icon: Award, color: 'text-amber-600' },
            { label: 'Business Share (70%)', value: businessShare, icon: Building2, color: 'text-primary' },
            { label: `PM Coord. Fee (${(pmFeeRate * 100).toFixed(0)}%)`, value: pmCoordinationFee, icon: Calculator, color: 'text-violet-600' },
            { label: 'PM Fee Collected', value: pmFeeCollected, icon: UserCheck, color: 'text-emerald-600' },
            { label: 'PM Fee Remaining', value: pmFeeRemaining, icon: DollarSign, color: pmFeeRemaining > 0 ? 'text-amber-600' : 'text-emerald-600' },
          ].map(item => (
            <div key={item.label} className="bg-muted/30 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <item.icon className={`w-3.5 h-3.5 ${item.color}`} />
                <p className="text-xs text-muted-foreground font-body">{item.label}</p>
              </div>
              <p className="text-lg font-display font-bold">${item.value.toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Section details */}
      {activeSection ? (
        <motion.div
          key={activeSection}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {(() => {
            const section = sections.find(s => s.key === activeSection)!;
            return (
              <div className="space-y-4">
                <h2 className="text-lg font-display font-bold flex items-center gap-2">
                  <section.icon className={`w-5 h-5 ${section.color}`} />
                  {section.title}
                </h2>
                {section.render()}
              </div>
            );
          })()}
        </motion.div>
      ) : (
        <div className="space-y-4">
          {sections.map(section => (
            <button
              key={section.key}
              onClick={() => setActiveSection(section.key)}
              className="w-full card-elevated p-5 flex items-center justify-between hover:shadow-md transition-all text-left"
            >
              <div className="flex items-center gap-3">
                <section.icon className={`w-5 h-5 ${section.color}`} />
                <span className="font-display font-semibold">{section.title}</span>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}
    </main>
  );
};

export default ProjectFinancials;
