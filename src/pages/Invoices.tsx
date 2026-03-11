import { FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useProjects, useInvoices } from '@/hooks/useProjects';
import { Badge } from '@/components/ui/badge';
import { ChevronRight } from 'lucide-react';

export default function Invoices() {
  const { t } = useTranslation();
  const { data: projects = [], isLoading } = useProjects();
  const { data: invoices = [] } = useInvoices();

  const activeProjects = projects.filter(p => p.status === 'active');
  const otherProjects = projects.filter(p => p.status !== 'active');

  const getProjectInvoiceCount = (projectId: string) =>
    invoices.filter((inv: any) => inv.project_id === projectId).length;

  const renderProjectRow = (project: typeof projects[0], dimmed = false) => {
    const count = getProjectInvoiceCount(project.id);
    return (
      <Link
        key={project.id}
        to={`/admin/invoices/${project.id}`}
        className={`card-elevated p-4 flex items-center justify-between hover:bg-muted/30 transition-colors rounded-lg ${dimmed ? 'opacity-70' : ''}`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-2 h-2 rounded-full ${dimmed ? 'bg-muted-foreground' : 'bg-primary'} flex-shrink-0`} />
          <div className="min-w-0">
            <p className="font-display font-semibold truncate">{project.name}</p>
            <p className="text-sm text-muted-foreground truncate">{project.address}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 ml-4">
          {count > 0 && (
            <Badge variant="secondary" className="text-xs">{count} invoice{count !== 1 ? 's' : ''}</Badge>
          )}
          <span className="text-xs text-muted-foreground font-body whitespace-nowrap">
            ${Number(project.amount_invoiced).toLocaleString()} / ${Number(project.total_budget).toLocaleString()}
          </span>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>
      </Link>
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display font-bold text-xl">{t('nav.invoices')}</h2>
          <p className="text-sm text-muted-foreground">{t('invoices.subtitle', 'Create and manage invoices for your projects')}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">Loading projects...</p>
        </div>
      ) : (
        <div className="space-y-2">
          {activeProjects.map(project => renderProjectRow(project))}

          {otherProjects.length > 0 && (
            <div className="pt-4">
              <p className="text-xs text-muted-foreground font-display font-semibold uppercase mb-2">Other Projects</p>
              {otherProjects.map(project => renderProjectRow(project, true))}
            </div>
          )}

          {projects.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-display font-semibold">{t('invoices.noProjects', 'No active projects')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
