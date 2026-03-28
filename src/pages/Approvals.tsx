import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, CheckCircle2, XCircle, ChevronDown, ChevronUp, FileText,
  DollarSign, Hammer, Receipt, ArrowRightLeft, Loader2, AlertCircle, Calculator,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useInvoices, useProjects, useUpdateInvoiceStatus } from '@/hooks/useProjects';
import { useSubmittedDrawSheets, useUpdateDrawSheetStatus, useDrawPayments, useSubPayEntries } from '@/hooks/useDrawSheet';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

type FilterStatus = 'all' | 'submitted' | 'approved' | 'rejected';

const FEE_TIERS = [
  { key: 'interior_buildout_billed', label: 'Interior Build Out', rate: 0.10 },
  { key: 'interior_construction_billed', label: 'Interior Construction', rate: 0.05 },
  { key: 'exterior_billed', label: 'Exterior', rate: 0.05 },
] as const;

const fmt = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const Approvals = () => {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<FilterStatus>('submitted');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rejectionNotes, setRejectionNotes] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState('invoices');

  const { data: invoices = [], isLoading } = useInvoices();
  const { data: projects = [] } = useProjects();
  const updateStatus = useUpdateInvoiceStatus();

  // Draw sheets
  const { data: drawSheets = [], isLoading: loadingSheets } = useSubmittedDrawSheets();
  const updateDrawStatus = useUpdateDrawSheetStatus();

  const statusConfig = {
    submitted: { icon: Clock, label: t('status.pending'), className: 'bg-warning/15 text-warning' },
    approved: { icon: CheckCircle2, label: t('status.approved'), className: 'bg-success/15 text-success' },
    rejected: { icon: XCircle, label: t('status.rejected'), className: 'bg-destructive/15 text-destructive' },
    draft: { icon: FileText, label: 'Draft', className: 'bg-muted text-muted-foreground' },
  };

  // Invoice filtering
  const filteredInvoices = filter === 'all' ? invoices : invoices.filter(i => i.status === filter);
  const pendingInvoiceCount = invoices.filter(i => i.status === 'submitted').length;

  // Draw sheet filtering (exclude drafts from approvals view)
  const nonDraftSheets = drawSheets.filter((s: any) => s.status !== 'draft');
  const filteredSheets = filter === 'all' ? nonDraftSheets : nonDraftSheets.filter((s: any) => s.status === filter);
  const pendingSheetCount = nonDraftSheets.filter((s: any) => s.status === 'submitted').length;

  const totalPending = pendingInvoiceCount + pendingSheetCount;

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

  const handleApproveSheet = async (id: string) => {
    updateDrawStatus.mutate(
      { id, status: 'approved' },
      {
        onSuccess: () => toast.success('Draw sheet approved'),
        onError: (e: any) => toast.error(`Failed: ${e.message}`),
      }
    );
  };

  const handleRejectSheet = async (id: string) => {
    updateDrawStatus.mutate(
      { id, status: 'rejected', rejectionNotes: rejectionNotes[id] || '' },
      {
        onSuccess: () => toast.success('Draw sheet rejected'),
        onError: (e: any) => toast.error(`Failed: ${e.message}`),
      }
    );
  };

  const toggle = (id: string) => setExpandedId(prev => prev === id ? null : id);

  if (isLoading || loadingSheets) {
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
            {totalPending === 1 ? t('approvals.awaitingReview_one', { count: totalPending }) : t('approvals.awaitingReview_other', { count: totalPending })}
          </p>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2">
        {([
          { value: 'submitted' as FilterStatus, label: `${t('approvals.pending')} (${activeTab === 'invoices' ? pendingInvoiceCount : pendingSheetCount})` },
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

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="invoices" className="gap-2">
            <Receipt className="w-4 h-4" />
            Invoices
            {pendingInvoiceCount > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 min-w-[20px] text-xs">{pendingInvoiceCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="draw-sheets" className="gap-2">
            <Calculator className="w-4 h-4" />
            PM Draw Sheets
            {pendingSheetCount > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 min-w-[20px] text-xs">{pendingSheetCount}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Invoices Tab */}
        <TabsContent value="invoices" className="mt-4">
          {filteredInvoices.length === 0 ? (
            <div className="card-elevated p-12 text-center text-muted-foreground font-body">
              {t('approvals.noInvoices')}
            </div>
          ) : (
            <div className="space-y-4">
              <AnimatePresence>
                {filteredInvoices.map((inv, i) => {
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

                              {inv.notes && (
                                <div className="bg-muted/30 rounded-lg p-4">
                                  <p className="text-sm font-medium mb-1">Notes</p>
                                  <p className="text-sm text-muted-foreground font-body">{inv.notes}</p>
                                </div>
                              )}

                              {inv.status === 'rejected' && (inv as any).rejection_notes && (
                                <div className="bg-destructive/5 border border-destructive/15 rounded-lg p-4">
                                  <p className="text-sm font-medium text-destructive mb-1">Rejection Reason:</p>
                                  <p className="text-sm text-destructive/80 font-body">{(inv as any).rejection_notes}</p>
                                </div>
                              )}

                              <div className="flex items-center justify-between bg-secondary/10 rounded-lg p-4">
                                <span className="font-display font-semibold text-lg">Invoice Total</span>
                                <span className="font-display font-bold text-2xl">{fmt(inv.grand_total)}</span>
                              </div>

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
        </TabsContent>

        {/* Draw Sheets Tab */}
        <TabsContent value="draw-sheets" className="mt-4">
          {filteredSheets.length === 0 ? (
            <div className="card-elevated p-12 text-center text-muted-foreground font-body">
              No draw sheets to review.
            </div>
          ) : (
            <div className="space-y-4">
              <AnimatePresence>
                {filteredSheets.map((sheet: any, i: number) => {
                  const project = projects.find(p => p.id === sheet.project_id);
                  const statusKey = sheet.status as keyof typeof statusConfig;
                  const status = statusConfig[statusKey] || statusConfig.submitted;
                  const StatusIcon = status.icon;
                  const expanded = expandedId === sheet.id;
                  const isMutating = updateDrawStatus.isPending && (updateDrawStatus.variables as any)?.id === sheet.id;

                  // Calculate tier fees
                  const tiers = FEE_TIERS.map(tier => {
                    const billed = Number(sheet[tier.key]) || 0;
                    return { ...tier, billed, fee: billed * tier.rate };
                  });
                  const totalFees = tiers.reduce((s, t) => s + t.fee, 0);

                  return (
                    <motion.div
                      key={sheet.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.97 }}
                      transition={{ delay: i * 0.03 }}
                      className="card-elevated overflow-hidden"
                    >
                      <button
                        onClick={() => toggle(sheet.id)}
                        className="w-full p-5 flex items-center justify-between text-left hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${status.className}`}>
                              <StatusIcon className="w-3 h-3" />
                              {status.label}
                            </span>
                            <span className="text-xs text-muted-foreground font-body">{sheet.last_updated}</span>
                          </div>
                          <h3 className="font-display font-semibold text-base">PM Draw Sheet</h3>
                          <p className="text-sm text-muted-foreground font-body">{project?.name || 'Unknown Project'}</p>
                        </div>
                        <div className="flex items-center gap-4 ml-4">
                          <p className="font-display font-bold text-xl">{fmt(totalFees)}</p>
                          {expanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                        </div>
                      </button>

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
                              {/* Fee tier breakdown */}
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {tiers.map(tier => (
                                  <div key={tier.key} className="bg-muted/50 rounded-lg p-3">
                                    <p className="text-xs text-muted-foreground font-body mb-1">{tier.label} ({(tier.rate * 100)}%)</p>
                                    <div className="flex justify-between items-baseline">
                                      <span className="text-xs text-muted-foreground">Billed: {fmt(tier.billed)}</span>
                                      <span className="font-display font-semibold text-sm">{fmt(tier.fee)}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* Total */}
                              <div className="flex items-center justify-between bg-secondary/10 rounded-lg p-4">
                                <span className="font-display font-semibold text-lg">Total Fees</span>
                                <span className="font-display font-bold text-2xl">{fmt(totalFees)}</span>
                              </div>

                              {/* Notes */}
                              {sheet.notes && (
                                <div className="bg-muted/30 rounded-lg p-4">
                                  <p className="text-sm font-medium mb-1">Notes</p>
                                  <p className="text-sm text-muted-foreground font-body">{sheet.notes}</p>
                                </div>
                              )}

                              {/* Rejection notes */}
                              {sheet.status === 'rejected' && sheet.rejection_notes && (
                                <div className="bg-destructive/5 border border-destructive/15 rounded-lg p-4">
                                  <p className="text-sm font-medium text-destructive mb-1">Rejection Reason:</p>
                                  <p className="text-sm text-destructive/80 font-body">{sheet.rejection_notes}</p>
                                </div>
                              )}

                              {/* Actions */}
                              {sheet.status === 'submitted' && (
                                <div className="space-y-3">
                                  <div>
                                    <label className="text-sm font-medium font-body mb-1.5 block">Rejection notes (optional)</label>
                                    <Textarea
                                      value={rejectionNotes[sheet.id] || ''}
                                      onChange={e => setRejectionNotes(prev => ({ ...prev, [sheet.id]: e.target.value }))}
                                      placeholder="Reason for rejection, if applicable..."
                                      rows={2}
                                    />
                                  </div>
                                  <div className="flex gap-3">
                                    <Button
                                      className="flex-1 bg-success text-success-foreground hover:bg-success/90 font-display"
                                      onClick={() => handleApproveSheet(sheet.id)}
                                      disabled={isMutating}
                                    >
                                      {isMutating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
                                      Approve Draw Sheet
                                    </Button>
                                    <Button
                                      variant="outline"
                                      className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/5 font-display"
                                      onClick={() => handleRejectSheet(sheet.id)}
                                      disabled={isMutating || !rejectionNotes[sheet.id]?.trim()}
                                    >
                                      {isMutating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <XCircle className="w-4 h-4 mr-1" />}
                                      Reject Draw Sheet
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
        </TabsContent>
      </Tabs>
    </main>
  );
};

export default Approvals;
