import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, Download, Send, TrendingUp, Calculator, Plus, Trash2, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { useProjects, useBudgetLineItems, useInvoices, useSubBudgets } from '@/hooks/useProjects';
import {
  useDrawSheet, useDrawSheetHistory, useUpsertDrawSheet,
  useDrawPayments, useAllDrawPayments, useAddDrawPayment, useDeleteDrawPayment,
  useSubPayEntries, useAddSubPayEntry, useDeleteSubPayEntry,
} from '@/hooks/useDrawSheet';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/hooks/use-toast';

const FEE_TIERS = [
  { key: 'interior-buildout', label: 'Interior Build Out', rate: 0.10, billedField: 'interior_buildout_billed' as const },
  { key: 'interior-construction', label: 'Interior Construction', rate: 0.05, billedField: 'interior_construction_billed' as const },
  { key: 'exterior', label: 'Exterior', rate: 0.05, billedField: 'exterior_billed' as const },
] as const;

function classifyGroup(item: any): typeof FEE_TIERS[number]['key'] {
  // Use explicit draw_category if mapped, otherwise fall back to heuristic
  if (item.draw_category) {
    if (item.draw_category === 'interior-buildout') return 'interior-buildout';
    if (item.draw_category === 'interior-construction') return 'interior-construction';
    if (item.draw_category === 'exterior') return 'exterior';
  }
  const lower = (item.cost_group || '').toLowerCase();
  if (lower.includes('exterior') || lower.includes('outdoor') || lower.includes('landscape') || lower.includes('site')) return 'exterior';
  if (lower.includes('construction') || lower.includes('structural') || lower.includes('framing') || lower.includes('foundation') || lower.includes('concrete') || lower.includes('roofing')) return 'interior-construction';
  return 'interior-buildout';
}

const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const PMDrawSheet = () => {
  const { user } = useAuth();
  const { data: projects = [], isLoading } = useProjects();
  const [activeProject, setActiveProject] = useState('');
  const { toast } = useToast();

  const selectedProjectId = activeProject || projects[0]?.id || '';
  const project = projects.find(p => p.id === selectedProjectId);

  // Budget line items for tier budget auto-calculation (master budget)
  const { data: budgetItems = [] } = useBudgetLineItems(selectedProjectId || undefined);

  // Sub budgets for project budget (what subs are paid against)
  const { data: subBudgets = [] } = useSubBudgets(selectedProjectId || undefined);

  // Approved invoices for auto-tracking sub payments
  const { data: allInvoices = [] } = useInvoices(selectedProjectId || undefined);
  const approvedInvoices = useMemo(() =>
    allInvoices.filter((inv: any) => inv.status === 'approved'),
    [allInvoices]
  );

  // Draw sheet state from DB
  const { data: drawSheet, isLoading: loadingSheet } = useDrawSheet(selectedProjectId || undefined, user?.id);
  const { data: drawSheetHistory = [] } = useDrawSheetHistory(selectedProjectId || undefined, user?.id);
  const upsertSheet = useUpsertDrawSheet();

  // Payments & sub pay entries (current draft)
  const { data: payments = [] } = useDrawPayments(drawSheet?.id);
  // ALL payments across all sheets for this project+PM (for running total)
  const { data: allPayments = [] } = useAllDrawPayments(selectedProjectId || undefined, user?.id);
  const addPayment = useAddDrawPayment();
  const deletePayment = useDeleteDrawPayment();
  const { data: subPayEntries = [] } = useSubPayEntries(drawSheet?.id);
  const addSubPay = useAddSubPayEntry();
  const deleteSubPay = useDeleteSubPayEntry();

  // Local form state for billed amounts
  const [billedAmounts, setBilledAmounts] = useState({
    interior_buildout_billed: 0,
    interior_construction_billed: 0,
    exterior_billed: 0,
  });
  const [notes, setNotes] = useState('');

  // New payment form
  const [newPaymentDate, setNewPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [newPaymentAmount, setNewPaymentAmount] = useState('');

  // New sub pay form
  const [newSubName, setNewSubName] = useState('');
  const [newSubAmount, setNewSubAmount] = useState('');
  const [newSubDesc, setNewSubDesc] = useState('');

  // Sync DB → local state
  useEffect(() => {
    if (drawSheet) {
      setBilledAmounts({
        interior_buildout_billed: Number(drawSheet.interior_buildout_billed) || 0,
        interior_construction_billed: Number(drawSheet.interior_construction_billed) || 0,
        exterior_billed: Number(drawSheet.exterior_billed) || 0,
      });
      setNotes(drawSheet.notes || '');
    } else {
      setBilledAmounts({ interior_buildout_billed: 0, interior_construction_billed: 0, exterior_billed: 0 });
      setNotes('');
    }
  }, [drawSheet]);

  // Auto-calculate tier budgets from master budget line items
  const tierBudgets = useMemo(() => {
    const totals: Record<string, number> = { 'interior-buildout': 0, 'interior-construction': 0, exterior: 0 };
    if (budgetItems.length > 0) {
      budgetItems.forEach(item => {
        const tier = classifyGroup(item);
        totals[tier] += Number(item.extended_cost);
      });
    } else if (project?.total_budget) {
      // Fallback: if no line items exist, put entire project budget under interior-buildout
      totals['interior-buildout'] = Number(project.total_budget);
    }
    return totals;
  }, [budgetItems, project?.total_budget]);

  // Tier calculations
  const tierData = useMemo(() => {
    return FEE_TIERS.map(tier => {
      const budget = tierBudgets[tier.key] || 0;
      const billed = billedAmounts[tier.billedField];
      // Total fee is calculated from master budget, not billed amounts
      const feeFromBudget = budget * tier.rate;
      const feeFromBilled = billed * tier.rate;
      // History: previous submitted/approved sheets
      const history = drawSheetHistory.map((sheet: any) => ({
        id: sheet.id,
        date: sheet.last_updated || sheet.created_at?.split('T')[0],
        billed: Number(sheet[tier.billedField]) || 0,
        fee: (Number(sheet[tier.billedField]) || 0) * tier.rate,
        status: sheet.status,
      }));
      const totalHistoryBilled = history.reduce((s: number, h: any) => s + h.billed, 0);
      const cumulativeBilled = totalHistoryBilled + billed;
      const pctBilled = budget > 0 ? (cumulativeBilled / budget) * 100 : 0;
      const totalHistoryPaid = history.filter((h: any) => h.status === 'approved').reduce((s: number, h: any) => s + h.fee, 0);
      return { ...tier, budget, billed, feeFromBudget, feeFromBilled, history, totalHistoryBilled, cumulativeBilled, pctBilled, totalHistoryPaid };
    });
  }, [tierBudgets, billedAmounts, drawSheetHistory]);

  // Total Fees = coordination fees earned from the master budget
  const totalFees = tierData.reduce((s, t) => s + t.feeFromBudget, 0);
  const totalPaid = allPayments.reduce((s: number, p: any) => s + Number(p.amount), 0);
  const totalSubPay = subPayEntries.reduce((s: number, e: any) => s + Number(e.amount), 0);
  const totalOwed = totalFees - totalPaid;

  // Bonus calculation
  // Project Budget = total of all sub budgets (what you manage subs against)
  // Sub Pay Cost = amount_paid on the project (auto-tracked from approved invoices)
  const subBudgetTotal = useMemo(() => {
    // We need sub budget line items totals - for now use the sub_budgets data
    // The project's total_budget is the master budget; amount_paid tracks approved invoice totals
    return Number(project?.total_budget || 0);
  }, [project]);

  // Auto-tracked sub payments from approved invoices
  const autoSubPayCost = Number(project?.amount_paid || 0);

  // Manual sub pay entries (supplementary tracking e.g. direct payments outside invoices)
  const manualSubPay = subPayEntries.reduce((s: number, e: any) => s + Number(e.amount), 0);
  const totalSubPayCost = autoSubPayCost + manualSubPay;

  const difference = Math.max(0, subBudgetTotal - totalSubPayCost);
  const bonus = difference * 0.30;

  // Save draw sheet
  const handleSave = async (status = 'draft') => {
    if (!user || !selectedProjectId) return;
    await upsertSheet.mutateAsync({
      id: drawSheet?.id || undefined,
      project_id: selectedProjectId,
      pm_user_id: user.id,
      ...billedAmounts,
      notes,
      status,
      last_updated: new Date().toISOString().split('T')[0],
    });
    toast({ title: status === 'submitted' ? 'Draw Sheet Submitted' : 'Draft Saved', description: status === 'submitted' ? 'Your draw sheet has been submitted to billing.' : 'Your progress has been saved.' });
    // On submit, clear local fields so PM starts fresh for next period
    if (status === 'submitted') {
      setBilledAmounts({ interior_buildout_billed: 0, interior_construction_billed: 0, exterior_billed: 0 });
      setNotes('');
    }
  };

  const handleAddPayment = async () => {
    if (!drawSheet?.id || !newPaymentAmount) return;
    // Need to save first if no draw sheet exists
    if (!drawSheet) {
      await handleSave();
    }
    await addPayment.mutateAsync({
      draw_sheet_id: drawSheet.id,
      payment_date: newPaymentDate,
      amount: parseFloat(newPaymentAmount),
      notes: '',
    });
    setNewPaymentAmount('');
  };

  const handleAddSubPay = async () => {
    if (!drawSheet?.id || !newSubName || !newSubAmount) return;
    await addSubPay.mutateAsync({
      draw_sheet_id: drawSheet.id,
      sub_name: newSubName,
      amount: parseFloat(newSubAmount),
      description: newSubDesc,
    });
    setNewSubName('');
    setNewSubAmount('');
    setNewSubDesc('');
  };

  if (isLoading) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-12 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display font-bold text-2xl">PM Draw Sheet</h2>
          <p className="text-sm text-muted-foreground">
            Track coordination fees, payments, and bonus projections
            {drawSheet?.last_updated && (
              <span className="ml-2 text-xs">· Last update: {drawSheet.last_updated}</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleSave('draft')} disabled={upsertSheet.isPending}>
            <Save className="w-4 h-4 mr-1" /> Save Draft
          </Button>
          <Button variant="outline" size="sm" onClick={() => { window.print(); }}>
            <Download className="w-4 h-4 mr-1" /> Export PDF
          </Button>
          <Button size="sm" onClick={() => handleSave('submitted')} disabled={upsertSheet.isPending} className="gradient-primary text-primary-foreground">
            <Send className="w-4 h-4 mr-1" /> Submit
          </Button>
        </div>
      </div>

      {/* Project Selector */}
      <div className="flex items-center gap-3">
        <Select value={selectedProjectId} onValueChange={setActiveProject}>
          <SelectTrigger className="w-80">
            <SelectValue placeholder="Select project" />
          </SelectTrigger>
          <SelectContent>
            {projects.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {drawSheet?.status && (
          <Badge variant={drawSheet.status === 'submitted' ? 'default' : 'secondary'}>
            {drawSheet.status}
          </Badge>
        )}
      </div>

      {project && !loadingSheet && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Total Fees', value: totalFees, icon: DollarSign, accent: 'text-primary' },
              { label: 'Paid', value: totalPaid, icon: DollarSign, accent: 'text-green-600' },
              { label: 'Owed', value: totalOwed, icon: DollarSign, accent: 'text-amber-600' },
              { label: 'Projected Bonus', value: bonus, icon: TrendingUp, accent: 'text-emerald-500' },
            ].map((stat, i) => (
              <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="card-elevated p-4">
                <div className="flex items-center gap-2 mb-1">
                  <stat.icon className={`w-4 h-4 ${stat.accent}`} />
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
                <p className={`text-xl font-display font-bold ${stat.accent}`}>${fmt(stat.value)}</p>
              </motion.div>
            ))}
          </div>

          {/* Fee Tiers with editable billing */}
          <Accordion type="multiple" defaultValue={FEE_TIERS.map(t => t.key)} className="space-y-3">
            {tierData.map(tier => (
              <AccordionItem key={tier.key} value={tier.key} className="border border-border rounded-lg overflow-hidden">
                <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/30">
                  <div className="flex items-center justify-between w-full pr-2">
                    <div className="flex items-center gap-3">
                      <span className="font-display font-bold text-base">{tier.label}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                        {(tier.rate * 100).toFixed(0)}%
                      </span>
                    </div>
                    <span className="font-display font-bold text-lg text-primary">
                      ${fmt(tier.feeFromBudget)}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-5 pb-4 space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Total (Budget)</p>
                      <p className="font-display font-semibold text-sm">${fmt(tier.budget)}</p>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Current Billing</label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={billedAmounts[tier.billedField] || ''}
                        onChange={e => setBilledAmounts(prev => ({
                          ...prev,
                          [tier.billedField]: parseFloat(e.target.value) || 0,
                        }))}
                        className="h-8 text-sm font-display"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Split</p>
                      <p className="font-display font-semibold text-sm">{(tier.rate * 100).toFixed(0)}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Fee (from Budget)</p>
                      <p className="font-display font-bold text-sm text-primary">${fmt(tier.feeFromBudget)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Fee This Draw</p>
                      <p className="font-display font-semibold text-sm">${fmt(tier.feeFromBilled)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Cumulative Billed</p>
                      <p className="font-display font-semibold text-sm">${fmt(tier.cumulativeBilled)}
                        {tier.budget > 0 && (
                          <span className="text-xs text-muted-foreground ml-1">({tier.pctBilled.toFixed(1)}%)</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Progress bar: cumulative billed vs budget */}
                  {tier.budget > 0 && tier.cumulativeBilled > 0 && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Billed vs Budget</span>
                        <span>{Math.min(100, tier.pctBilled).toFixed(1)}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${Math.min(100, tier.pctBilled)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Previous billing history */}
                  {tier.history.length > 0 && (
                    <div className="border-t border-border pt-3">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Previous Billing History</p>
                      <div className="space-y-1">
                        {tier.history.map((h: any) => (
                          <div key={h.id} className="flex justify-between items-center text-xs">
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">{h.date}</span>
                              <Badge variant={h.status === 'approved' ? 'default' : h.status === 'rejected' ? 'destructive' : 'secondary'} className="text-[10px] h-4">
                                {h.status}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-display font-medium">${fmt(h.billed)}</span>
                              <span className="text-muted-foreground">→ fee ${fmt(h.fee)}</span>
                              {h.status === 'approved' && (
                                <span className="text-green-600 text-[10px] font-medium">PAID</span>
                              )}
                            </div>
                          </div>
                        ))}
                        <div className="flex justify-between items-center text-xs font-medium pt-1 border-t border-border">
                          <span className="text-muted-foreground">Total Previously Billed</span>
                          <span className="font-display">${fmt(tier.totalHistoryBilled)}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs font-medium">
                          <span className="text-muted-foreground">Total Fees Paid</span>
                          <span className="font-display text-green-600">${fmt(tier.totalHistoryPaid)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          {/* Totals & Payments */}
          <div className="card-elevated p-5 space-y-4">
            <div className="flex justify-between items-center">
              <span className="font-display font-bold text-lg">TOTAL</span>
              <span className="font-display font-bold text-xl">${fmt(totalFees)}</span>
            </div>

            {/* Payments section */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-medium">Paid</span>
                <span className="text-green-600 font-semibold">- ${fmt(totalPaid)}</span>
              </div>
              {allPayments.map((p: any) => (
                <div key={p.id} className="flex justify-between items-center text-xs pl-4">
                  <span className="text-muted-foreground">{p.payment_date}</span>
                  <div className="flex items-center gap-2">
                    <span>${fmt(Number(p.amount))}</span>
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => deletePayment.mutate({ id: p.id, drawSheetId: drawSheet?.id })}>
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
              {/* Add payment form */}
              {drawSheet?.id && (
                <div className="flex items-center gap-2 pl-4 pt-1">
                  <Input type="date" value={newPaymentDate} onChange={e => setNewPaymentDate(e.target.value)} className="h-7 text-xs w-36" />
                  <Input type="number" step="0.01" min="0" placeholder="Amount" value={newPaymentAmount} onChange={e => setNewPaymentAmount(e.target.value)} className="h-7 text-xs w-28" />
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleAddPayment} disabled={addPayment.isPending}>
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Minus Sub Labor</span>
              <span className="font-semibold">$0.00</span>
            </div>

            <div className="border-t border-border pt-3 flex justify-between items-center">
              <span className="font-display font-bold text-lg text-primary">Owed</span>
              <span className="font-display font-bold text-2xl text-primary">${fmt(totalOwed)}</span>
            </div>
          </div>

          {/* Bonus Section */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card-elevated p-5">
            <h3 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-emerald-500" />
              Bonus (in progress)
            </h3>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Left: calculations */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Project Budget</span>
                  <span className="font-display font-semibold">${fmt(subBudgetTotal)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Approved Invoices (auto)</span>
                  <span className="font-display font-semibold">- ${fmt(autoSubPayCost)}</span>
                </div>
                {manualSubPay > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Other Sub Payments</span>
                    <span className="font-display font-semibold">- ${fmt(manualSubPay)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-sm font-medium">
                  <span className="text-muted-foreground">Total Sub Pay Cost</span>
                  <span className="font-display font-semibold">- ${fmt(totalSubPayCost)}</span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Savings</span>
                  <span className={`font-display font-semibold ${difference > 0 ? 'text-emerald-500' : 'text-destructive'}`}>${fmt(difference)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Split</span>
                  <span className="font-display font-semibold">30%</span>
                </div>
                <div className="border-t border-border pt-3 flex justify-between items-center">
                  <span className="font-display font-bold text-lg">Bonus</span>
                  <span className="font-display font-bold text-2xl text-emerald-500">${fmt(bonus)}</span>
                </div>
              </div>

              {/* Right: breakdown */}
              <div className="space-y-3">
                {/* Auto-tracked approved invoices */}
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-2">Approved Invoices — ${fmt(autoSubPayCost)}</p>
                  {approvedInvoices.length > 0 ? approvedInvoices.map((inv: any) => (
                    <div key={inv.id} className="flex justify-between items-center text-xs border-b border-border pb-1 mb-1">
                      <div>
                        <span className="font-medium">{inv.subcontractor_name || 'Invoice'}</span>
                        <span className="text-muted-foreground ml-2">#{inv.invoice_number}</span>
                      </div>
                      <span className="font-display font-semibold">${fmt(Number(inv.grand_total))}</span>
                    </div>
                  )) : (
                    <p className="text-xs text-muted-foreground">No approved invoices yet.</p>
                  )}
                </div>

                {/* Manual sub pay entries */}
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-2">Other Sub Payments — ${fmt(manualSubPay)}</p>
                  {subPayEntries.map((e: any) => (
                    <div key={e.id} className="flex justify-between items-center text-xs border-b border-border pb-1 mb-1">
                      <div>
                        <span className="font-medium">{e.sub_name}</span>
                        {e.description && <span className="text-muted-foreground ml-2">{e.description}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-display font-semibold">${fmt(Number(e.amount))}</span>
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => deleteSubPay.mutate({ id: e.id, drawSheetId: drawSheet?.id })}>
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {/* Add sub pay form */}
                  {drawSheet?.id && (
                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      <Input placeholder="Sub Name" value={newSubName} onChange={e => setNewSubName(e.target.value)} className="h-7 text-xs w-28" />
                      <Input type="number" step="0.01" min="0" placeholder="Amount" value={newSubAmount} onChange={e => setNewSubAmount(e.target.value)} className="h-7 text-xs w-24" />
                      <Input placeholder="Work (e.g. Interior Install)" value={newSubDesc} onChange={e => setNewSubDesc(e.target.value)} className="h-7 text-xs w-36" />
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleAddSubPay} disabled={addSubPay.isPending}>
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Notes */}
          <div className="card-elevated p-5">
            <label className="text-sm font-medium mb-2 block">Notes</label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add any notes about this draw period..."
              className="min-h-[80px]"
            />
          </div>

          {!drawSheet?.id && (
            <p className="text-xs text-muted-foreground text-center">
              Save your draw sheet first to add payments and sub pay entries.
            </p>
          )}
        </>
      )}

      {!project && projects.length > 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <DollarSign className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>Select a project to view your draw sheet.</p>
        </div>
      )}
    </main>
  );
};

export default PMDrawSheet;
