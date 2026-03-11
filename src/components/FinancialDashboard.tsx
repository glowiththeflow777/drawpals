import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DollarSign, FileText, CheckCircle2, Wallet, X, TrendingUp } from 'lucide-react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import type { DbBudgetLineItem } from '@/hooks/useProjects';

type DashboardTab = 'budget' | 'invoiced' | 'approved' | 'remaining' | null;

interface FinancialDashboardProps {
  project: {
    total_budget: number;
    amount_invoiced: number;
    amount_paid: number;
  };
  budgetItems: DbBudgetLineItem[];
  invoiceLineItems: any[];
  billingHistory: Map<string, number>;
}

const FinancialDashboard: React.FC<FinancialDashboardProps> = ({
  project,
  budgetItems,
  invoiceLineItems,
  billingHistory,
}) => {
  const [activeTab, setActiveTab] = useState<DashboardTab>(null);

  const totalBudget = Number(project.total_budget);
  const invoiced = Number(project.amount_invoiced);
  const approved = Number(project.amount_paid);
  const remaining = totalBudget - invoiced;

  const stats: { key: DashboardTab; label: string; value: number; icon: React.ElementType; color: string }[] = [
    { key: 'budget', label: 'Total Budget', value: totalBudget, icon: Wallet, color: 'text-primary' },
    { key: 'invoiced', label: 'Invoiced', value: invoiced, icon: FileText, color: 'text-amber-600' },
    { key: 'approved', label: 'Approved', value: approved, icon: CheckCircle2, color: 'text-emerald-600' },
    { key: 'remaining', label: 'Remaining', value: remaining, icon: TrendingUp, color: 'text-sky-600' },
  ];

  const handleClick = (key: DashboardTab) => {
    setActiveTab(prev => (prev === key ? null : key));
  };

  // Group budget items by cost_group
  const groupByCostGroup = (items: DbBudgetLineItem[]) => {
    const groups: Record<string, DbBudgetLineItem[]> = {};
    items.forEach(item => {
      const group = item.cost_group || 'Ungrouped';
      if (!groups[group]) groups[group] = [];
      groups[group].push(item);
    });
    return groups;
  };

  // Filter invoice line items by status
  const getFilteredInvoiceItems = (status?: string) => {
    if (!status) return invoiceLineItems;
    return invoiceLineItems.filter((ili: any) => ili.invoices?.status === status);
  };

  // Aggregate invoice line items by budget_line_item_id
  const aggregateByBudgetItem = (items: any[]) => {
    const map = new Map<string, { totalDrawn: number; count: number }>();
    items.forEach((ili: any) => {
      const key = ili.budget_line_item_id;
      const existing = map.get(key) || { totalDrawn: 0, count: 0 };
      existing.totalDrawn += Number(ili.draw_amount);
      existing.count += 1;
      map.set(key, existing);
    });
    return map;
  };

  const renderBudgetBreakdown = () => {
    const groups = groupByCostGroup(budgetItems);
    return (
      <div className="space-y-4">
        {Object.entries(groups).map(([group, items]) => {
          const groupTotal = items.reduce((s, i) => s + Number(i.extended_cost), 0);
          return (
            <div key={group}>
              <div className="flex items-center justify-between px-2 py-1.5 bg-muted/50 rounded-md mb-1">
                <span className="text-sm font-display font-semibold">{group}</span>
                <span className="text-sm font-display font-bold">${groupTotal.toLocaleString()}</span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">#</TableHead>
                    <TableHead className="text-xs">Item</TableHead>
                    <TableHead className="text-xs">Type</TableHead>
                    <TableHead className="text-xs text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map(item => (
                    <TableRow key={item.id}>
                      <TableCell className="text-muted-foreground">{item.line_item_no}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{item.cost_item_name}</p>
                          {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="px-1.5 py-0.5 rounded text-xs bg-muted text-muted-foreground">{item.cost_type}</span>
                      </TableCell>
                      <TableCell className="text-right font-display font-semibold">${Number(item.extended_cost).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          );
        })}
        <div className="flex justify-between items-center px-2 py-3 border-t border-border">
          <span className="font-display font-bold">Grand Total</span>
          <span className="font-display font-bold text-lg">${totalBudget.toLocaleString()}</span>
        </div>
      </div>
    );
  };

  const renderInvoicedBreakdown = (statusFilter?: string) => {
    const filtered = statusFilter
      ? getFilteredInvoiceItems(statusFilter)
      : invoiceLineItems.filter((ili: any) => ili.invoices?.status !== 'rejected');
    const aggregated = aggregateByBudgetItem(filtered);
    const totalDrawn = Array.from(aggregated.values()).reduce((s, v) => s + v.totalDrawn, 0);

    if (aggregated.size === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">No {statusFilter || 'invoiced'} items yet.</p>
        </div>
      );
    }

    const groups = groupByCostGroup(budgetItems);

    return (
      <div className="space-y-4">
        {Object.entries(groups).map(([group, items]) => {
          const groupItems = items.filter(i => aggregated.has(i.id));
          if (groupItems.length === 0) return null;
          const groupTotal = groupItems.reduce((s, i) => s + (aggregated.get(i.id)?.totalDrawn || 0), 0);
          return (
            <div key={group}>
              <div className="flex items-center justify-between px-2 py-1.5 bg-muted/50 rounded-md mb-1">
                <span className="text-sm font-display font-semibold">{group}</span>
                <span className="text-sm font-display font-bold">${groupTotal.toLocaleString()}</span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">#</TableHead>
                    <TableHead className="text-xs">Item</TableHead>
                    <TableHead className="text-xs text-right">Budget</TableHead>
                    <TableHead className="text-xs text-right">{statusFilter === 'approved' ? 'Approved' : 'Invoiced'}</TableHead>
                    <TableHead className="text-xs text-right">% Used</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupItems.map(item => {
                    const agg = aggregated.get(item.id)!;
                    const budget = Number(item.extended_cost);
                    const pct = budget > 0 ? Math.round((agg.totalDrawn / budget) * 100) : 0;
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="text-muted-foreground">{item.line_item_no}</TableCell>
                        <TableCell>
                          <p className="font-medium text-sm">{item.cost_item_name}</p>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">${budget.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-display font-semibold">${agg.totalDrawn.toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center gap-2 justify-end">
                            <Progress value={Math.min(100, pct)} className="w-16 h-1.5" />
                            <span className="text-xs text-muted-foreground w-8">{pct}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          );
        })}
        <div className="flex justify-between items-center px-2 py-3 border-t border-border">
          <span className="font-display font-bold">Total {statusFilter === 'approved' ? 'Approved' : 'Invoiced'}</span>
          <span className="font-display font-bold text-lg">${totalDrawn.toLocaleString()}</span>
        </div>
      </div>
    );
  };

  const renderRemainingBreakdown = () => {
    const groups = groupByCostGroup(budgetItems);
    return (
      <div className="space-y-4">
        {Object.entries(groups).map(([group, items]) => {
          const groupRemaining = items.reduce((s, i) => {
            const billed = billingHistory.get(i.id) || 0;
            return s + Math.max(0, Number(i.extended_cost) - billed);
          }, 0);
          return (
            <div key={group}>
              <div className="flex items-center justify-between px-2 py-1.5 bg-muted/50 rounded-md mb-1">
                <span className="text-sm font-display font-semibold">{group}</span>
                <span className="text-sm font-display font-bold">${groupRemaining.toLocaleString()}</span>
              </div>
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
                  {items.map(item => {
                    const budget = Number(item.extended_cost);
                    const billed = billingHistory.get(item.id) || 0;
                    const rem = Math.max(0, budget - billed);
                    const pct = budget > 0 ? Math.round((billed / budget) * 100) : 0;
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="text-muted-foreground">{item.line_item_no}</TableCell>
                        <TableCell>
                          <p className="font-medium text-sm">{item.cost_item_name}</p>
                        </TableCell>
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
            </div>
          );
        })}
        <div className="flex justify-between items-center px-2 py-3 border-t border-border">
          <span className="font-display font-bold">Total Remaining</span>
          <span className="font-display font-bold text-lg">${remaining.toLocaleString()}</span>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'budget': return renderBudgetBreakdown();
      case 'invoiced': return renderInvoicedBreakdown();
      case 'approved': return renderInvoicedBreakdown('approved');
      case 'remaining': return renderRemainingBreakdown();
      default: return null;
    }
  };

  const tabTitles: Record<string, string> = {
    budget: 'Total Budget Breakdown',
    invoiced: 'Invoiced Breakdown',
    approved: 'Approved Breakdown',
    remaining: 'Remaining Budget',
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-display font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
        <DollarSign className="w-4 h-4" />
        Financial Dashboard
      </h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map(stat => {
          const isActive = activeTab === stat.key;
          return (
            <button
              key={stat.key}
              onClick={() => handleClick(stat.key)}
              className={`card-elevated p-4 text-left transition-all hover:shadow-md ${
                isActive ? 'ring-2 ring-primary shadow-md' : ''
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
                <p className="text-xs text-muted-foreground font-body">{stat.label}</p>
              </div>
              <p className="text-xl font-display font-bold">${stat.value.toLocaleString()}</p>
              {stat.key !== 'budget' && totalBudget > 0 && (
                <div className="mt-2">
                  <Progress
                    value={Math.min(100, (stat.value / totalBudget) * 100)}
                    className="h-1.5"
                  />
                </div>
              )}
            </button>
          );
        })}
      </div>

      <AnimatePresence>
        {activeTab && (
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="card-elevated p-5">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-display font-semibold text-lg">{tabTitles[activeTab]}</h4>
                <button onClick={() => setActiveTab(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                {renderContent()}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FinancialDashboard;
