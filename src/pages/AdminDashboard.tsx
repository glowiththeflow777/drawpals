import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { FileText, CheckCircle2, DollarSign, TrendingUp, BarChart3, Loader2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProjects, useBudgetLineItems } from '@/hooks/useProjects';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

const CHART_COLORS = ['hsl(32,90%,50%)', 'hsl(160,40%,45%)', 'hsl(210,70%,50%)', 'hsl(45,93%,47%)'];

const AdminDashboard = () => {
  const { t } = useTranslation();
  const { data: projects = [], isLoading: loadingProjects } = useProjects();
  const { data: allBudgetItems = [] } = useBudgetLineItems();
  const [activeProject, setActiveProject] = useState<string>('all');
  const { toast } = useToast();

  const getExportData = useCallback(() => {
    const items = activeProject === 'all'
      ? allBudgetItems
      : allBudgetItems.filter(b => b.project_id === activeProject);
    const projectName = activeProject === 'all'
      ? t('adminDashboard.allProjects')
      : projects.find(p => p.id === activeProject)?.name || t('common.project');
    return { items, projectName };
  }, [activeProject, allBudgetItems, projects, t]);

  const handleExportPDF = () => {
    window.print();
    toast({ title: t('adminDashboard.pdfTitle'), description: t('adminDashboard.pdfDesc') });
  };

  const handleExportExcel = () => {
    const { items, projectName } = getExportData();
    if (items.length === 0) {
      toast({ title: t('adminDashboard.noDataExport'), variant: 'destructive' });
      return;
    }
    const rows = items.map(bi => ({
      'Line #': bi.line_item_no,
      'Cost Code': bi.cost_code,
      'Item Name': bi.cost_item_name,
      'Description': bi.description,
      'Cost Group': bi.cost_group,
      'Cost Type': bi.cost_type,
      'Quantity': bi.quantity,
      'Unit': bi.unit,
      'Extended Cost': Number(bi.extended_cost),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Budget');
    XLSX.writeFile(wb, `${projectName.replace(/[^a-zA-Z0-9]/g, '_')}_budget.xlsx`);
    toast({ title: t('adminDashboard.excelSuccess') });
  };

  const handleExportQuickBooks = () => {
    const { items, projectName } = getExportData();
    if (items.length === 0) {
      toast({ title: t('adminDashboard.noDataExport'), variant: 'destructive' });
      return;
    }
    const lines = [
      '!TRNS\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tMEMO',
      '!SPL\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tMEMO',
      '!ENDTRNS',
    ];
    const today = new Date().toLocaleDateString('en-US');
    items.forEach(bi => {
      const amt = Number(bi.extended_cost);
      lines.push(`TRNS\tGENERAL JOURNAL\t${today}\tConstruction Costs\t${bi.cost_item_name}\t${amt.toFixed(2)}\t${bi.description || bi.cost_item_name}`);
      lines.push(`SPL\tGENERAL JOURNAL\t${today}\tAccounts Payable\t${bi.cost_item_name}\t${(-amt).toFixed(2)}\t${bi.description || bi.cost_item_name}`);
      lines.push('ENDTRNS');
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName.replace(/[^a-zA-Z0-9]/g, '_')}_quickbooks.iif`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: t('adminDashboard.qbSuccess') });
  };

  const filtered = activeProject === 'all' ? projects : projects.filter(p => p.id === activeProject);

  const totalBudget = filtered.reduce((s, p) => s + Number(p.total_budget), 0);
  const totalInvoiced = filtered.reduce((s, p) => s + Number(p.amount_invoiced), 0);
  const totalPaid = filtered.reduce((s, p) => s + Number(p.amount_paid), 0);
  const remaining = totalBudget - totalInvoiced;
  const budgetSavings = Math.max(0, totalBudget - totalPaid);
  const pmBonus = budgetSavings * 0.30;
  const businessShare = budgetSavings * 0.70;

  const pieData = [
    { name: t('adminDashboard.pieLabels.paid'), value: totalPaid },
    { name: t('adminDashboard.pieLabels.invoicedUnpaid'), value: totalInvoiced - totalPaid },
    { name: t('adminDashboard.pieLabels.remaining'), value: remaining },
  ];

  const budgetItems = activeProject === 'all'
    ? allBudgetItems.slice(0, 8)
    : allBudgetItems.filter(b => b.project_id === activeProject).slice(0, 8);

  const varianceData = budgetItems.slice(0, 5).map(bi => ({
    name: bi.cost_item_name.substring(0, 15) + '...',
    [t('adminDashboard.budgetVsActualBudget')]: Number(bi.extended_cost),
    [t('adminDashboard.budgetVsActualActual')]: Number(bi.extended_cost) * (0.5 + Math.random() * 0.7),
  }));

  if (loadingProjects) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-12 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  return (
    <>
      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Project Filter */}
        <div className="flex items-center gap-3">
          <label className="text-sm font-display font-semibold text-muted-foreground">{t('adminDashboard.project')}</label>
          <Select value={activeProject} onValueChange={setActiveProject}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder={t('adminDashboard.selectProject')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('adminDashboard.allProjects')}</SelectItem>
              {projects.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: t('adminDashboard.totalBudget'), value: totalBudget, icon: DollarSign, color: 'text-foreground' },
            { label: t('adminDashboard.invoiced'), value: totalInvoiced, icon: FileText, color: 'text-info' },
            { label: t('adminDashboard.paid'), value: totalPaid, icon: CheckCircle2, color: 'text-success' },
            { label: t('adminDashboard.remaining'), value: remaining, icon: TrendingUp, color: 'text-warning' },
          ].map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="card-elevated p-4">
              <div className="flex items-center gap-2 mb-1">
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
                <p className="text-xs text-muted-foreground font-body">{stat.label}</p>
              </div>
              <p className={`text-xl lg:text-2xl font-display font-bold ${stat.color}`}>${stat.value.toLocaleString()}</p>
            </motion.div>
          ))}
        </div>

        {/* PM Bonus Calculator */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card-elevated p-5">
          <h3 className="font-display font-semibold text-lg mb-3 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-success" />
            {t('adminDashboard.bonus.title')}
          </h3>
          <p className="text-xs text-muted-foreground mb-4">{t('adminDashboard.bonus.explanation')}</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground font-body">{t('adminDashboard.totalBudget')}</p>
              <p className="text-lg font-display font-bold">${totalBudget.toLocaleString()}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground font-body">{t('adminDashboard.bonus.actualCost')}</p>
              <p className="text-lg font-display font-bold">${totalPaid.toLocaleString()}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground font-body">{t('adminDashboard.bonus.savings')}</p>
              <p className="text-lg font-display font-bold text-success">${budgetSavings.toLocaleString()}</p>
            </div>
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
              <p className="text-xs text-muted-foreground font-body">{t('adminDashboard.bonus.pmBonus')} (30%)</p>
              <p className="text-xl font-display font-bold text-primary">${pmBonus.toLocaleString()}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
            <span>{t('adminDashboard.bonus.businessShare')} (70%): <strong className="text-foreground">${businessShare.toLocaleString()}</strong></span>
          </div>
        </motion.div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="card-elevated p-4">
            <h3 className="font-display font-semibold mb-4">{t('adminDashboard.budgetBreakdown')}</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {pieData.map((_, idx) => <Cell key={idx} fill={CHART_COLORS[idx]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="card-elevated p-4">
            <h3 className="font-display font-semibold mb-4">{t('adminDashboard.budgetVsActual')}</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={varianceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(35,15%,85%)" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => `$${v.toFixed(0)}`} />
                <Bar dataKey={t('adminDashboard.budgetVsActualBudget')} fill={CHART_COLORS[0]} name={t('adminDashboard.budgetVsActualBudget')} radius={[4,4,0,0]} />
                <Bar dataKey={t('adminDashboard.budgetVsActualActual')} fill={CHART_COLORS[1]} name={t('adminDashboard.budgetVsActualActual')} radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Budget Line Items */}
        <div>
          <h3 className="font-display font-semibold text-lg mb-3 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-muted-foreground" />
            {t('adminDashboard.budgetLineItems')}
          </h3>
          {budgetItems.length === 0 ? (
            <p className="text-muted-foreground text-sm card-elevated p-6 text-center">{t('adminDashboard.noBudgetItems')}</p>
          ) : (
            <div className="card-elevated overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-3 font-display font-semibold text-muted-foreground text-xs">{t('adminDashboard.lineNo')}</th>
                      <th className="text-left p-3 font-display font-semibold text-muted-foreground text-xs">{t('adminDashboard.item')}</th>
                      <th className="text-left p-3 font-display font-semibold text-muted-foreground text-xs">{t('adminDashboard.costGroup')}</th>
                      <th className="text-right p-3 font-display font-semibold text-muted-foreground text-xs">{t('common.budget')}</th>
                      <th className="text-left p-3 font-display font-semibold text-muted-foreground text-xs">{t('adminDashboard.costType')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {budgetItems.map(bi => (
                      <tr key={bi.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="p-3 font-body">{bi.line_item_no}</td>
                        <td className="p-3 font-body">{bi.cost_item_name}</td>
                        <td className="p-3 font-body text-muted-foreground text-xs">{bi.cost_group}</td>
                        <td className="p-3 text-right font-display font-semibold">${Number(bi.extended_cost).toLocaleString()}</td>
                        <td className="p-3"><span className="px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground">{bi.cost_type}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Export */}
        <div className="flex gap-3 flex-wrap">
          <Button variant="outline" className="font-display" onClick={handleExportPDF}>
            <Download className="w-4 h-4 mr-1" /> {t('adminDashboard.exportPDF')}
          </Button>
          <Button variant="outline" className="font-display" onClick={handleExportExcel}>
            <Download className="w-4 h-4 mr-1" /> {t('adminDashboard.exportExcel')}
          </Button>
          <Button variant="outline" className="font-display" onClick={handleExportQuickBooks}>
            <Download className="w-4 h-4 mr-1" /> {t('adminDashboard.exportQuickBooks')}
          </Button>
        </div>
      </main>
    </>
  );
};

export default AdminDashboard;
