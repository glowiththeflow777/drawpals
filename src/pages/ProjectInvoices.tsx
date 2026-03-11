import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, FileText, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useProjects, useInvoices } from '@/hooks/useProjects';
import { useTranslation } from 'react-i18next';

export default function ProjectInvoices() {
  const { projectId } = useParams<{ projectId: string }>();
  const { t } = useTranslation();
  const { data: projects = [] } = useProjects();
  const { data: invoices = [] } = useInvoices(projectId);

  const project = projects.find(p => p.id === projectId);

  const statusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-success/10 text-success';
      case 'rejected': return 'bg-destructive/10 text-destructive';
      default: return 'bg-warning/10 text-warning';
    }
  };

  const fmt = (n: number) =>
    `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (!project) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6 text-center text-muted-foreground">
        <p>Project not found.</p>
        <Link to="/admin/invoices" className="text-primary underline text-sm mt-2 inline-block">Back to Invoices</Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/admin/invoices">
          <Button variant="ghost" size="icon" className="shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h2 className="font-display font-bold text-xl truncate">{project.name}</h2>
          <p className="text-sm text-muted-foreground">{project.address}</p>
        </div>
        <Link to={`/invoice/new?project=${project.id}&admin=true`}>
          <Button className="gradient-primary text-primary-foreground gap-1.5">
            <Plus className="w-4 h-4" />
            {t('invoices.newInvoice', 'New Invoice')}
          </Button>
        </Link>
      </div>

      {/* Budget summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Budget', value: project.total_budget },
          { label: 'Invoiced', value: project.amount_invoiced },
          { label: 'Paid', value: project.amount_paid },
        ].map(item => (
          <div key={item.label} className="card-elevated p-4">
            <p className="text-xs text-muted-foreground font-body">{item.label}</p>
            <p className="font-display font-bold text-lg">{fmt(Number(item.value))}</p>
          </div>
        ))}
      </div>

      {/* Invoice list */}
      {invoices.length === 0 ? (
        <div className="card-elevated p-12 text-center text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-display font-semibold">No invoices yet</p>
          <p className="text-sm mt-1">Submit an invoice to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-display font-semibold uppercase">
            {invoices.length} Invoice{invoices.length !== 1 ? 's' : ''}
          </p>
          {invoices.map((inv: any) => (
            <div
              key={inv.id}
              className="card-elevated p-4 flex items-center justify-between hover:bg-muted/30 transition-colors rounded-lg"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="font-display font-semibold truncate">
                    {inv.subcontractor_name || 'Invoice'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(inv.invoice_date).toLocaleDateString()} · #{inv.invoice_number}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 ml-4">
                <div className="text-right">
                  <p className="font-display font-bold">{fmt(Number(inv.grand_total))}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {Number(inv.sow_total) > 0 && (
                      <span className="text-[10px] text-muted-foreground">SOW {fmt(Number(inv.sow_total))}</span>
                    )}
                    {Number(inv.day_labor_total) > 0 && (
                      <span className="text-[10px] text-muted-foreground">· Labor {fmt(Number(inv.day_labor_total))}</span>
                    )}
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize whitespace-nowrap ${statusColor(inv.status)}`}>
                  {inv.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
