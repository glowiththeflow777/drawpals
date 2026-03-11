import { FileText, Plus, ChevronDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useProjects } from '@/hooks/useProjects';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useState } from 'react';

export default function SubcontractorInvoices() {
  const { t } = useTranslation();
  const { data: projects = [], isLoading } = useProjects();
  const [openProjects, setOpenProjects] = useState<Set<string>>(new Set());

  const toggleProject = (id: string) => {
    setOpenProjects(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const activeProjects = projects.filter(p => p.status === 'active');

  if (isLoading) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-12 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display font-bold text-xl">{t('nav.invoices')}</h2>
          <p className="text-sm text-muted-foreground">View and submit invoices for your assigned projects</p>
        </div>
      </div>

      <div className="space-y-3">
        {activeProjects.map(project => (
          <Collapsible
            key={project.id}
            open={openProjects.has(project.id)}
            onOpenChange={() => toggleProject(project.id)}
          >
            <CollapsibleTrigger asChild>
              <button className="w-full card-elevated p-4 flex items-center justify-between hover:bg-muted/30 transition-colors rounded-lg text-left">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                  <div>
                    <p className="font-display font-semibold">{project.name}</p>
                    <p className="text-sm text-muted-foreground">{project.address}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground font-body">
                    ${Number(project.amount_invoiced).toLocaleString()} / ${Number(project.total_budget).toLocaleString()}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${openProjects.has(project.id) ? 'rotate-180' : ''}`} />
                </div>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="ml-5 mt-2 p-4 border border-border rounded-lg bg-muted/20 space-y-3">
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Budget</p>
                    <p className="font-display font-semibold">${Number(project.total_budget).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Invoiced</p>
                    <p className="font-display font-semibold">${Number(project.amount_invoiced).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Paid</p>
                    <p className="font-display font-semibold">${Number(project.amount_paid).toLocaleString()}</p>
                  </div>
                </div>
                <Link to={`/invoice/new?project=${project.id}`}>
                  <Button size="sm" className="gradient-primary text-primary-foreground gap-1.5 w-full">
                    <Plus className="w-4 h-4" />
                    {t('invoices.newInvoice', 'New Invoice')}
                  </Button>
                </Link>
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))}

        {activeProjects.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-display font-semibold">No projects assigned</p>
          </div>
        )}
      </div>
    </div>
  );
}
