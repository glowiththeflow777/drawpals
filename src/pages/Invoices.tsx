import { FileText, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useProjects } from '@/hooks/useProjects';

export default function Invoices() {
  const { t } = useTranslation();
  const { data: projects = [] } = useProjects();
  const activeProjects = projects.filter(p => p.status === 'active');

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display font-bold text-xl">{t('nav.invoices')}</h2>
          <p className="text-sm text-muted-foreground">{t('invoices.subtitle', 'Create and manage invoices for your projects')}</p>
        </div>
      </div>

      <div className="space-y-3">
        {activeProjects.map(project => (
          <div key={project.id} className="card-elevated p-4 flex items-center justify-between">
            <div>
              <p className="font-display font-semibold">{project.name}</p>
              <p className="text-sm text-muted-foreground">{project.address}</p>
            </div>
            <Link to={`/invoice/new?project=${project.id}&admin=true`}>
              <Button size="sm" variant="outline" className="gap-1.5">
                <Plus className="w-4 h-4" />
                {t('invoices.newInvoice', 'New Invoice')}
              </Button>
            </Link>
          </div>
        ))}

        {activeProjects.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-display font-semibold">{t('invoices.noProjects', 'No active projects')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
