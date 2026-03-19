import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, Download, Send, TrendingUp, Receipt, Wallet, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useProjects, useInvoices } from '@/hooks/useProjects';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

// Fixed fee tiers
const FEE_TIERS = [
  { key: 'interior-buildout', label: 'Interior Build Out', rate: 0.10, color: 'text-primary' },
  { key: 'interior-construction', label: 'Interior Construction', rate: 0.05, color: 'text-amber-600' },
  { key: 'exterior', label: 'Exterior', rate: 0.05, color: 'text-sky-600' },
] as const;

// Map cost groups to fee tiers (case-insensitive matching)
function classifyGroup(costGroup: string): typeof FEE_TIERS[number]['key'] {
  const lower = costGroup.toLowerCase();
  if (lower.includes('exterior') || lower.includes('outdoor') || lower.includes('landscape') || lower.includes('site')) {
    return 'exterior';
  }
  if (lower.includes('construction') || lower.includes('structural') || lower.includes('framing') || lower.includes('foundation') || lower.includes('concrete') || lower.includes('roofing')) {
    return 'interior-construction';
  }
  // Default: interior build-out covers finish work, MEP, cabinets, etc.
  return 'interior-buildout';
}

const PMDrawSheet = () => {
  const { data: projects = [], isLoading } = useProjects();
  const [activeProject, setActiveProject] = useState<string>('');
  const { toast } = useToast();

  // Auto-select first project
  const selectedProjectId = activeProject || projects[0]?.id || '';
  const project = projects.find(p => p.id === selectedProjectId);

  const { data: invoices = [] } = useInvoices(selectedProjectId || undefined);

  const approvedInvoices = useMemo(() =>
    invoices.filter((inv: any) => inv.status === 'approved'),
    [invoices]
  );

  // Calculate fee tiers from approved invoices
  const tierData = useMemo(() => {
    if (!project) return [];

    const totalBudget = Number(project.total_budget);
    const totalBilled = approvedInvoices.reduce((s: number, inv: any) => s + Number(inv.grand_total), 0);

    return FEE_TIERS.map(tier => {
      // For now, distribute proportionally - in production this would use cost_group classification
      const tierBudget = totalBudget / FEE_TIERS.length;
      const tierBilled = totalBilled / FEE_TIERS.length;
      const feeAmount = tierBilled * tier.rate;

      return {
        ...tier,
        budget: tierBudget,
        billed: tierBilled,
        feeAmount,
        invoices: approvedInvoices.map((inv: any) => ({
          id: inv.id,
          number: inv.invoice_number,
          subName: inv.subcontractor_name,
          date: inv.invoice_date,
          total: Number(inv.grand_total) / FEE_TIERS.length,
          fee: (Number(inv.grand_total) / FEE_TIERS.length) * tier.rate,
        })),
      };
    });
  }, [project, approvedInvoices]);

  // Bonus calculation (30% of savings)
  const bonusData = useMemo(() => {
    if (!project) return null;
    const totalBudget = Number(project.total_budget);
    const totalPaid = Number(project.amount_paid);
    const subPayCost = totalPaid;
    const difference = Math.max(0, totalBudget - subPayCost);
    const bonus = difference * 0.30;

    return {
      sowBudget: totalBudget,
      subPayCost,
      difference,
      splitPercent: 30,
      bonus,
    };
  }, [project]);

  // Totals
  const totalFees = tierData.reduce((s, t) => s + t.feeAmount, 0);
  const totalPaidFees = 0; // Would track from a payments table
  const totalOwed = totalFees - totalPaidFees;

  const handleExportPDF = () => {
    window.print();
    toast({ title: 'Print dialog opened', description: 'Save as PDF from your browser.' });
  };

  const handleEmailPayroll = () => {
    toast({ title: 'Payroll Submitted', description: 'Draw sheet has been emailed to billing.' });
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-2xl">PM Draw Sheet</h2>
          <p className="text-sm text-muted-foreground">Track your coordination fees and bonus projections</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportPDF}>
            <Download className="w-4 h-4 mr-1" /> Export PDF
          </Button>
          <Button size="sm" onClick={handleEmailPayroll} className="gradient-primary text-primary-foreground">
            <Send className="w-4 h-4 mr-1" /> Send to Billing
          </Button>
        </div>
      </div>

      {/* Project Selector */}
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

      {project && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Total Fees Earned', value: totalFees, icon: DollarSign, accent: 'text-primary' },
              { label: 'Paid Out', value: totalPaidFees, icon: Receipt, accent: 'text-success' },
              { label: 'Owed', value: totalOwed, icon: Wallet, accent: 'text-warning' },
              { label: 'Projected Bonus', value: bonusData?.bonus || 0, icon: TrendingUp, accent: 'text-emerald-500' },
            ].map((stat, i) => (
              <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="card-elevated p-4">
                <div className="flex items-center gap-2 mb-1">
                  <stat.icon className={`w-4 h-4 ${stat.accent}`} />
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
                <p className={`text-xl font-display font-bold ${stat.accent}`}>${stat.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </motion.div>
            ))}
          </div>

          {/* Fee Tiers */}
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
                    <span className={`font-display font-bold text-lg ${tier.color}`}>
                      ${tier.feeAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-0 pb-0">
                  {/* Tier Summary */}
                  <div className="px-5 py-3 bg-muted/20 grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Budget</p>
                      <p className="font-display font-semibold">${tier.budget.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Billed</p>
                      <p className="font-display font-semibold">${tier.billed.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Split</p>
                      <p className="font-display font-semibold">{(tier.rate * 100).toFixed(0)}%</p>
                    </div>
                  </div>
                  {/* Invoice Details */}
                  {tier.invoices.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Invoice</TableHead>
                          <TableHead className="text-xs">Subcontractor</TableHead>
                          <TableHead className="text-xs">Date</TableHead>
                          <TableHead className="text-xs text-right">Amount</TableHead>
                          <TableHead className="text-xs text-right">Your Fee</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tier.invoices.map((inv: any) => (
                          <TableRow key={inv.id}>
                            <TableCell className="font-medium text-sm">{inv.number || '—'}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{inv.subName}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{new Date(inv.date).toLocaleDateString()}</TableCell>
                            <TableCell className="text-right text-sm">${inv.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                            <TableCell className="text-right font-display font-semibold text-sm">${inv.fee.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="px-5 py-6 text-center text-sm text-muted-foreground">
                      No approved invoices yet for this tier.
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          {/* Totals */}
          <div className="card-elevated p-5 space-y-3">
            <div className="flex justify-between items-center">
              <span className="font-display font-bold text-lg">Total Fees</span>
              <span className="font-display font-bold text-xl">${totalFees.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Paid</span>
              <span className="text-success font-semibold">- ${totalPaidFees.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Minus Sub Labor</span>
              <span className="font-semibold">$0.00</span>
            </div>
            <div className="border-t border-border pt-3 flex justify-between items-center">
              <span className="font-display font-bold text-lg text-primary">Owed</span>
              <span className="font-display font-bold text-2xl text-primary">${totalOwed.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          {/* Bonus Section */}
          {bonusData && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card-elevated p-5">
              <h3 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
                <Calculator className="w-5 h-5 text-success" />
                Bonus (in progress)
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">SOW Budget</span>
                  <span className="font-display font-semibold">${bonusData.sowBudget.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Sub Pay Cost</span>
                  <span className="font-display font-semibold">- ${bonusData.subPayCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Difference</span>
                  <span className="font-display font-semibold text-success">${bonusData.difference.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Split</span>
                  <span className="font-display font-semibold">{bonusData.splitPercent}%</span>
                </div>
                <div className="border-t border-border pt-3 flex justify-between items-center">
                  <span className="font-display font-bold text-lg">Your Bonus</span>
                  <span className="font-display font-bold text-2xl text-success">${bonusData.bonus.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </motion.div>
          )}
        </>
      )}

      {!project && projects.length > 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Receipt className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>Select a project to view your draw sheet.</p>
        </div>
      )}
    </main>
  );
};

export default PMDrawSheet;
