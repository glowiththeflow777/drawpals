import { motion } from 'framer-motion';
import { FolderOpen, FileSpreadsheet, Loader2, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useProjects, useBudgetLineItems } from '@/hooks/useProjects';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';

export default function SubcontractorProjects() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: projects = [], isLoading } = useProjects();

  if (isLoading) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-12 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <h2 className="font-display font-bold text-xl flex items-center gap-2">
        <FolderOpen className="w-5 h-5 text-muted-foreground" />
        {t('nav.myProjects', 'My Projects')}
      </h2>

      {projects.length === 0 ? (
        <div className="card-elevated p-8 text-center">
          <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground font-body">No projects assigned to you yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {projects.map((project, i) => {
            const invoicedPct = Number(project.total_budget) > 0
              ? (Number(project.amount_invoiced) / Number(project.total_budget)) * 100
              : 0;
            return (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="card-elevated p-5 space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-display font-semibold text-lg">{project.name}</h3>
                    <p className="text-sm text-muted-foreground font-body">{project.address}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${
                    project.status === 'active' ? 'status-badge-approved' :
                    project.status === 'on-hold' ? 'bg-amber-500/10 text-amber-600' :
                    project.status === 'completed' ? 'status-badge-pending' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {project.status}
                  </span>
                </div>

                {/* Budget Progress */}
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Budget</p>
                      <p className="font-display font-semibold">${Number(project.total_budget).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Invoiced</p>
                      <p className="font-display font-semibold">${Number(project.amount_invoiced).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Approved</p>
                      <p className="font-display font-semibold">${Number(project.amount_paid).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, invoicedPct)}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{invoicedPct.toFixed(0)}% invoiced</span>
                    <span>${(Number(project.total_budget) - Number(project.amount_invoiced)).toLocaleString()} remaining</span>
                  </div>
                </div>

                <Button
                  size="sm"
                  className="gradient-primary text-primary-foreground gap-1.5"
                  onClick={() => navigate(`/invoice/new?project=${project.id}`)}
                >
                  <Plus className="w-4 h-4" />
                  Submit Invoice
                </Button>
              </motion.div>
            );
          })}
        </div>
      )}
    </main>
  );
}
