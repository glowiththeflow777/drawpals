import { useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Plus, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { mockInvoices, mockProjects, mockUser } from '@/data/mockData';

const statusConfig = {
  pending: { icon: Clock, label: 'Pending', className: 'status-badge-pending' },
  approved: { icon: CheckCircle2, label: 'Approved', className: 'status-badge-approved' },
  rejected: { icon: XCircle, label: 'Rejected', className: 'status-badge-rejected' },
  draft: { icon: AlertCircle, label: 'Draft', className: 'status-badge-pending' },
};

const SubcontractorDashboard = () => {
  const navigate = useNavigate();
  const [activeProject, setActiveProject] = useState<string>('all');

  const filteredInvoices = activeProject === 'all'
    ? mockInvoices
    : mockInvoices.filter(inv => inv.projectId === activeProject);

  const totalPending = mockInvoices.filter(i => i.status === 'pending').reduce((s, i) => s + i.totals.total, 0);
  const totalApproved = mockInvoices.filter(i => i.status === 'approved').reduce((s, i) => s + i.totals.total, 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="gradient-dark px-4 py-4 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center">
              <Building2 className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display font-bold text-secondary-foreground text-sm">Budget Builder</h1>
              <p className="text-secondary-foreground/50 text-xs">{mockUser.crewName}</p>
            </div>
          </div>
          <Link to="/">
            <Button variant="ghost" size="sm" className="text-secondary-foreground/50 hover:text-secondary-foreground">
              <LogOut className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card-elevated p-4">
            <p className="text-xs text-muted-foreground font-body">Pending</p>
            <p className="text-2xl font-display font-bold text-warning">${totalPending.toLocaleString()}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card-elevated p-4">
            <p className="text-xs text-muted-foreground font-body">Approved</p>
            <p className="text-2xl font-display font-bold text-success">${totalApproved.toLocaleString()}</p>
          </motion.div>
        </div>

        {/* New Invoice Button */}
        <Button
          onClick={() => navigate('/invoice/new')}
          className="w-full gradient-primary text-primary-foreground py-6 text-lg font-display rounded-xl shadow-lg"
        >
          <Plus className="w-5 h-5 mr-2" /> Submit New Invoice
        </Button>

        {/* Project Filter */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setActiveProject('all')}
            className={`px-4 py-2 rounded-full text-sm font-body whitespace-nowrap transition-colors ${activeProject === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
          >
            All Projects
          </button>
          {mockProjects.filter(p => p.status === 'active').map(p => (
            <button
              key={p.id}
              onClick={() => setActiveProject(p.id)}
              className={`px-4 py-2 rounded-full text-sm font-body whitespace-nowrap transition-colors ${activeProject === p.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
            >
              {p.name}
            </button>
          ))}
        </div>

        {/* Invoices */}
        <div className="space-y-3">
          <h2 className="font-display font-semibold text-lg">Your Invoices</h2>
          {filteredInvoices.map((inv, i) => {
            const status = statusConfig[inv.status];
            const StatusIcon = status.icon;
            const project = mockProjects.find(p => p.id === inv.projectId);
            return (
              <motion.div
                key={inv.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="card-elevated p-4 cursor-pointer hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-display font-semibold">{project?.name}</p>
                    <p className="text-xs text-muted-foreground font-body">Draw: {inv.payrollDrawDate}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${status.className}`}>
                    <StatusIcon className="w-3 h-3" />
                    {status.label}
                  </span>
                </div>
                <div className="flex items-end justify-between">
                  <div className="flex gap-4 text-xs text-muted-foreground font-body">
                    <span>{inv.lineItems.length} line items</span>
                    {inv.dayLabor.length > 0 && <span>{inv.dayLabor.length} day labor</span>}
                  </div>
                  <p className="font-display font-bold text-lg">${inv.totals.total.toLocaleString()}</p>
                </div>
                {inv.status === 'rejected' && inv.rejectionNotes && (
                  <div className="mt-3 p-3 rounded-lg bg-destructive/5 border border-destructive/10">
                    <p className="text-xs text-destructive font-medium mb-1">Revision needed:</p>
                    <p className="text-xs text-destructive/80">{inv.rejectionNotes}</p>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </main>
    </div>
  );
};

export default SubcontractorDashboard;
