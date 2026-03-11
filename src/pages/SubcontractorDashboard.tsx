import { motion } from 'framer-motion';
import { FileText, Plus, Clock, CheckCircle2, DollarSign, FolderOpen, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useProjects } from '@/hooks/useProjects';

const SubcontractorDashboard = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { data: projects = [], isLoading } = useProjects();

  const activeProjects = projects.filter(p => p.status === 'active');
  const totalBudget = projects.reduce((s, p) => s + Number(p.total_budget), 0);
  const totalInvoiced = projects.reduce((s, p) => s + Number(p.amount_invoiced), 0);
  const totalPaid = projects.reduce((s, p) => s + Number(p.amount_paid), 0);

  if (isLoading) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-12 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: t('dashboard.assignedProjects', 'Assigned Projects'), value: activeProjects.length.toString(), icon: FolderOpen, color: 'text-foreground', prefix: '' },
          { label: t('adminDashboard.totalBudget', 'Total Budget'), value: totalBudget, icon: DollarSign, color: 'text-foreground', prefix: '$' },
          { label: t('dashboard.pending', 'Pending'), value: totalInvoiced - totalPaid, icon: Clock, color: 'text-warning', prefix: '$' },
          { label: t('dashboard.approved', 'Paid'), value: totalPaid, icon: CheckCircle2, color: 'text-success', prefix: '$' },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="card-elevated p-4">
            <div className="flex items-center gap-2 mb-1">
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
              <p className="text-xs text-muted-foreground font-body">{stat.label}</p>
            </div>
            <p className={`text-xl font-display font-bold ${stat.color}`}>
              {stat.prefix}{typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
            </p>
          </motion.div>
        ))}
      </div>

      {/* New Invoice Button */}
      <Button
        onClick={() => navigate('/invoice/new')}
        className="w-full gradient-primary text-primary-foreground py-6 text-lg font-display rounded-xl shadow-lg"
      >
        <Plus className="w-5 h-5 mr-2" /> {t('dashboard.submitNew', 'Submit New Invoice')}
      </Button>

      {/* Assigned Projects */}
      <div className="space-y-3">
        <h2 className="font-display font-semibold text-lg flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-muted-foreground" />
          {t('dashboard.yourProjects', 'Your Projects')}
        </h2>
        {activeProjects.length === 0 ? (
          <div className="card-elevated p-8 text-center">
            <FolderOpen className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground font-body text-sm">No projects assigned yet.</p>
          </div>
        ) : (
          activeProjects.map((project, i) => {
            const invoicedPct = Number(project.total_budget) > 0
              ? (Number(project.amount_invoiced) / Number(project.total_budget)) * 100
              : 0;
            return (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="card-elevated p-4 cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => navigate(`/dashboard/projects`)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-display font-semibold">{project.name}</p>
                    <p className="text-xs text-muted-foreground font-body">{project.address}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium status-badge-approved capitalize">
                    {project.status}
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, invoicedPct)}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>${Number(project.amount_invoiced).toLocaleString()} invoiced</span>
                    <span>${Number(project.total_budget).toLocaleString()} budget</span>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </main>
  );
};

export default SubcontractorDashboard;
