import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, CheckCircle2, XCircle, ChevronDown, ChevronUp, FileText,
  DollarSign, Hammer, Receipt, ArrowRightLeft, Loader2, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useInvoices, useProjects, useUpdateInvoiceStatus } from '@/hooks/useProjects';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

type FilterStatus = 'all' | 'submitted' | 'approved' | 'rejected';

const Approvals = () => {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<FilterStatus>('submitted');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rejectionNotes, setRejectionNotes] = useState<Record<string, string>>({});

  const { data: invoices = [], isLoading } = useInvoices();
  const { data: projects = [] } = useProjects();
  const updateStatus = useUpdateInvoiceStatus();

  const statusConfig = {
    submitted: { icon: Clock, label: t('status.pending'), className: 'bg-warning/15 text-warning' },
    approved: { icon: CheckCircle2, label: t('status.approved'), className: 'bg-success/15 text-success' },
    rejected: { icon: XCircle, label: t('status.rejected'), className: 'bg-destructive/15 text-destructive' },
  };

  const fmt = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const filtered = filter === 'all' ? invoices : invoices.filter(i => i.status === filter);
  const pendingCount = invoices.filter(i => i.status === 'submitted').length;

  const handleApprove = async (id: string) => {
    updateStatus.mutate(
      { invoiceId: id, status: 'approved' },
      {
        onSuccess: () => toast.success('Invoice approved'),
        onError: (e) => toast.error(`Failed: ${e.message}`),
      }
    );
  };

  const handleReject = async (id: string) => {
    updateStatus.mutate(
      { invoiceId: id, status: 'rejected', rejectionNotes: rejectionNotes[id] || '' },
      {
        onSuccess: () => toast.success('Invoice rejected'),
        onError: (e) => toast.error(`Failed: ${e.message}`),
      }
    );
  };

  const toggle = (id: string) => setExpandedId(prev => prev === id ? null : id);

  if (isLoading) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-6 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold">{t('approvals.title')}</h2>
          <p className="text-sm text-muted-foreground font-body mt-1">
            {pendingCount === 1 ? t('approvals.awaitingReview_one', { count: pendingCount }) : t('approvals.awaitingReview_other', { count: pendingCount })}
          </p>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2">
        {([
          { value: 'submitted' as FilterStatus, label: `${t('approvals.pending')} (${pendingCount})` },
          { value: 'approved' as FilterStatus, label: t('approvals.approved') },
          { value: 'rejected' as FilterStatus, label: t('approvals.rejected') },
          { value: 'all' as FilterStatus, label: t('common.all') },
        ]).map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-4 py-2 rounded-full text-sm font-body whitespace-nowrap transition-colors ${
              filter === f.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Invoice list */}
      {filtered.length === 0 ? (
        <div className="card-elevated p-12 text-center text-muted-foreground font-body">
          {t('approvals.noInvoices')}
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {filtered.map((inv, i) => {
              const project = projects.find(p => p.id === inv.project_id);
              const statusKey = inv.status as keyof typeof statusConfig;
              const status = statusConfig[statusKey] || statusConfig.submitted;
              const StatusIcon = status.icon;
              const expanded = expandedId === inv.id;
              const isMutating = updateStatus.isPending && updateStatus.variables?.invoiceId === inv.id;

              return (
                <motion.div
                  key={inv.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ delay: i * 0.03 }}
                  className="card-elevated overflow-hidden"
                >
                  {/* Summary row */}
                  <button
                    onClick={() => toggle(inv.id)}
                    className="w-full p-5 flex items-center justify-between text-left hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${status.className}`}>
                          <StatusIcon className="w-3 h-3" />
                          {status.label}
                        </span>
                        <span className="text-xs text-muted-foreground font-body">{inv.invoice_date}</span>
                      </div>
                      <h3 className="font-display font-semibold text-base">{inv.subcontractor_name || 'Invoice'} — #{inv.invoice_number}</h3>
                      <p className="text-sm text-muted-foreground font-body">{project?.name || 'Unknown Project'}</p>
                    </div>
                    <div className="flex items-center gap-4 ml-4">
                      <p className="font-display font-bold text-xl">{fmt(inv.grand_total)}</p>
                      {expanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                    </div>
                  </button>

                  {/* Expanded details */}
                  <AnimatePresence>
                    {expanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-5 border-t border-border space-y-5 pt-5">
                          {/* Totals summary */}
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                            {[
                              { label: 'SOW Draw', value: inv.sow_total, icon: FileText },
                              { label: 'Day Labor', value: inv.day_labor_total, icon: Hammer },
                              { label: 'Reimbursements', value: inv.reimbursement_total, icon: Receipt },
                              { label: 'Change Orders', value: inv.change_order_total, icon: ArrowRightLeft },
                              { label: 'Credits', value: inv.credit_total, icon: DollarSign },
                            ].map(t => (
                              <div key={t.label} className="bg-muted/50 rounded-lg p-3">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <t.icon className="w-3.5 h-3.5 text-muted-foreground" />
                                  <span className="text-xs text-muted-foreground font-body">{t.label}</span>
                                </div>
                                <p className="font-display font-semibold text-sm">{fmt(t.value)}</p>
                              </div>
                            ))}
                          </div>

                          {/* Notes */}
                          {inv.notes && (
                            <div className="bg-muted/30 rounded-lg p-4">
                              <p className="text-sm font-medium mb-1">Notes</p>
                              <p className="text-sm text-muted-foreground font-body">{inv.notes}</p>
                            </div>
                          )}

                          {/* Rejection notes (if rejected) */}
                          {inv.status === 'rejected' && (inv as any).rejection_notes && (
                            <div className="bg-destructive/5 border border-destructive/15 rounded-lg p-4">
                              <p className="text-sm font-medium text-destructive mb-1">Rejection Reason:</p>
                              <p className="text-sm text-destructive/80 font-body">{(inv as any).rejection_notes}</p>
                            </div>
                          )}

                          {/* Grand total */}
                          <div className="flex items-center justify-between bg-secondary/10 rounded-lg p-4">
                            <span className="font-display font-semibold text-lg">Invoice Total</span>
                            <span className="font-display font-bold text-2xl">{fmt(inv.grand_total)}</span>
                          </div>

                          {/* Actions for submitted invoices */}
                          {inv.status === 'submitted' && (
                            <div className="space-y-3">
                              <div>
                                <label className="text-sm font-medium font-body mb-1.5 block">Rejection notes (optional)</label>
                                <Textarea
                                  value={rejectionNotes[inv.id] || ''}
                                  onChange={e => setRejectionNotes(prev => ({ ...prev, [inv.id]: e.target.value }))}
                                  placeholder="Reason for rejection, if applicable..."
                                  rows={2}
                                />
                              </div>
                              <div className="flex gap-3">
                                <Button
                                  className="flex-1 bg-success text-success-foreground hover:bg-success/90 font-display"
                                  onClick={() => handleApprove(inv.id)}
                                  disabled={isMutating}
                                >
                                  {isMutating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
                                  Approve Invoice
                                </Button>
                                <Button
                                  variant="outline"
                                  className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/5 font-display"
                                  onClick={() => handleReject(inv.id)}
                                  disabled={isMutating || !rejectionNotes[inv.id]?.trim()}
                                >
                                  {isMutating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <XCircle className="w-4 h-4 mr-1" />}
                                  Reject Invoice
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </main>
  );
};

export default Approvals;
