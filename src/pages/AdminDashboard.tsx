import { useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, CheckCircle2, XCircle, Clock, DollarSign, TrendingUp, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { mockInvoices, mockProjects, mockBudgetLineItems } from '@/data/mockData';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const CHART_COLORS = ['hsl(32,90%,50%)', 'hsl(160,40%,45%)', 'hsl(210,70%,50%)', 'hsl(45,93%,47%)'];

const AdminDashboard = () => {
  const [activeProject, setActiveProject] = useState<string>('all');

  const filteredInvoices = activeProject === 'all'
    ? mockInvoices
    : mockInvoices.filter(inv => inv.projectId === activeProject);

  const pending = filteredInvoices.filter(i => i.status === 'pending');
  const totalBudget = (activeProject === 'all' ? mockProjects : mockProjects.filter(p => p.id === activeProject))
    .reduce((s, p) => s + p.totalBudget, 0);
  const totalInvoiced = (activeProject === 'all' ? mockProjects : mockProjects.filter(p => p.id === activeProject))
    .reduce((s, p) => s + p.amountInvoiced, 0);
  const totalPaid = (activeProject === 'all' ? mockProjects : mockProjects.filter(p => p.id === activeProject))
    .reduce((s, p) => s + p.amountPaid, 0);
  const remaining = totalBudget - totalInvoiced;

  const pieData = [
    { name: 'Paid', value: totalPaid },
    { name: 'Invoiced (Unpaid)', value: totalInvoiced - totalPaid },
    { name: 'Remaining', value: remaining },
  ];

  const budgetItems = mockBudgetLineItems.slice(0, 5);
  const varianceData = budgetItems.map(bi => ({
    name: bi.costItemName.substring(0, 15) + '...',
    budget: bi.extendedCost,
    actual: bi.extendedCost * (0.5 + Math.random() * 0.7),
  }));

  return (
    <>
      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Project Filter */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          <button onClick={() => setActiveProject('all')} className={`px-4 py-2 rounded-full text-sm font-body whitespace-nowrap transition-colors ${activeProject === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
            All Projects
          </button>
          {mockProjects.map(p => (
            <button key={p.id} onClick={() => setActiveProject(p.id)} className={`px-4 py-2 rounded-full text-sm font-body whitespace-nowrap transition-colors ${activeProject === p.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              {p.name}
            </button>
          ))}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Total Budget', value: totalBudget, icon: DollarSign, color: 'text-foreground' },
            { label: 'Invoiced', value: totalInvoiced, icon: FileText, color: 'text-info' },
            { label: 'Paid', value: totalPaid, icon: CheckCircle2, color: 'text-success' },
            { label: 'Remaining', value: remaining, icon: TrendingUp, color: 'text-warning' },
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

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="card-elevated p-4">
            <h3 className="font-display font-semibold mb-4">Budget Breakdown</h3>
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
            <h3 className="font-display font-semibold mb-4">Budget vs Actual</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={varianceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(35,15%,85%)" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => `$${v.toFixed(0)}`} />
                <Bar dataKey="budget" fill={CHART_COLORS[0]} name="Budget" radius={[4,4,0,0]} />
                <Bar dataKey="actual" fill={CHART_COLORS[1]} name="Actual" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pending Approvals */}
        <div>
          <h3 className="font-display font-semibold text-lg mb-3 flex items-center gap-2">
            <Clock className="w-5 h-5 text-warning" />
            Pending Approvals ({pending.length})
          </h3>
          {pending.length === 0 ? (
            <p className="text-muted-foreground text-sm card-elevated p-6 text-center">No pending invoices</p>
          ) : (
            <div className="space-y-3">
              {pending.map(inv => {
                const project = mockProjects.find(p => p.id === inv.projectId);
                return (
                  <motion.div key={inv.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card-elevated p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-display font-semibold">{inv.crewName}</p>
                        <p className="text-xs text-muted-foreground">{project?.name} • Draw: {inv.payrollDrawDate}</p>
                      </div>
                      <p className="font-display font-bold text-lg">${inv.totals.total.toLocaleString()}</p>
                    </div>
                    <div className="flex gap-4 text-xs text-muted-foreground mb-3">
                      <span>SOW: ${inv.totals.sowDraw.toLocaleString()}</span>
                      <span>Labor: ${inv.totals.dayRateLabor.toLocaleString()}</span>
                      <span>Reimb: ${inv.totals.reimbursement.toLocaleString()}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1 bg-success text-success-foreground hover:bg-success/90 font-display">
                        <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/5 font-display">
                        <XCircle className="w-4 h-4 mr-1" /> Reject
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* All Invoices */}
        <div>
          <h3 className="font-display font-semibold text-lg mb-3 flex items-center gap-2">
            <FileText className="w-5 h-5 text-muted-foreground" />
            All Invoices
          </h3>
          <div className="card-elevated overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 font-display font-semibold text-muted-foreground text-xs">Crew</th>
                    <th className="text-left p-3 font-display font-semibold text-muted-foreground text-xs">Project</th>
                    <th className="text-left p-3 font-display font-semibold text-muted-foreground text-xs">Draw Date</th>
                    <th className="text-right p-3 font-display font-semibold text-muted-foreground text-xs">Total</th>
                    <th className="text-center p-3 font-display font-semibold text-muted-foreground text-xs">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map(inv => {
                    const project = mockProjects.find(p => p.id === inv.projectId);
                    const statusClass = inv.status === 'approved' ? 'status-badge-approved' : inv.status === 'rejected' ? 'status-badge-rejected' : 'status-badge-pending';
                    return (
                      <tr key={inv.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="p-3 font-body">{inv.crewName}</td>
                        <td className="p-3 font-body text-muted-foreground">{project?.name}</td>
                        <td className="p-3 font-body text-muted-foreground">{inv.payrollDrawDate}</td>
                        <td className="p-3 text-right font-display font-semibold">${inv.totals.total.toLocaleString()}</td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${statusClass}`}>{inv.status}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Budget Line Items */}
        <div>
          <h3 className="font-display font-semibold text-lg mb-3 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-muted-foreground" />
            Budget Line Items
          </h3>
          <div className="card-elevated overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 font-display font-semibold text-muted-foreground text-xs">#</th>
                    <th className="text-left p-3 font-display font-semibold text-muted-foreground text-xs">Item</th>
                    <th className="text-left p-3 font-display font-semibold text-muted-foreground text-xs">Cost Group</th>
                    <th className="text-right p-3 font-display font-semibold text-muted-foreground text-xs">Budget</th>
                    <th className="text-left p-3 font-display font-semibold text-muted-foreground text-xs">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {budgetItems.map(bi => (
                    <tr key={bi.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="p-3 font-body">{bi.lineItemNo}</td>
                      <td className="p-3 font-body">{bi.costItemName}</td>
                      <td className="p-3 font-body text-muted-foreground text-xs">{bi.costGroup}</td>
                      <td className="p-3 text-right font-display font-semibold">${bi.extendedCost.toLocaleString()}</td>
                      <td className="p-3"><span className="px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground">{bi.costType}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Export */}
        <div className="flex gap-3">
          <Button variant="outline" className="font-display">Export PDF</Button>
          <Button variant="outline" className="font-display">Export Excel</Button>
          <Button variant="outline" className="font-display">Export to QuickBooks</Button>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
