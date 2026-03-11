import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, FileText, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useProjects, useInvoices, useDeleteInvoice } from '@/hooks/useProjects';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

export default function ProjectInvoices() {
  const { projectId } = useParams<{ projectId: string }>();
  const { t } = useTranslation();
  const { toast } = useToast();
  const { data: projects = [] } = useProjects();
  const { data: invoices = [] } = useInvoices(projectId);
  const deleteInvoice = useDeleteInvoice();

  const [deleteTarget, setDeleteTarget] = useState<any>(null);

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

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteInvoice.mutateAsync(deleteTarget.id);
      toast({ title: 'Invoice deleted', description: `Invoice #${deleteTarget.invoice_number} has been removed and project totals updated.` });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setDeleteTarget(null);
  };

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
          { label: 'Approved', value: project.amount_paid },
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
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => setDeleteTarget(inv)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Delete Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (
                <>
                  Are you sure you want to delete invoice <strong>#{deleteTarget.invoice_number}</strong> from{' '}
                  <strong>{deleteTarget.subcontractor_name}</strong> for{' '}
                  <strong>{fmt(Number(deleteTarget.grand_total))}</strong>?
                  {deleteTarget.status === 'approved' && (
                    <span className="block mt-2 text-destructive font-medium">
                      This invoice is approved. Deleting it will subtract {fmt(Number(deleteTarget.grand_total))} from the project's invoiced and approved totals.
                    </span>
                  )}
                  <span className="block mt-2">This action cannot be undone.</span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Invoice
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
