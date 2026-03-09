import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, CheckCircle2, XCircle, ChevronDown, ChevronUp, FileText,
  DollarSign, Hammer, Receipt, ArrowRightLeft, Loader2, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { mockInvoices, mockProjects } from '@/data/mockData';
import type { Invoice } from '@/types/budget';

type FilterStatus = 'all' | 'pending' | 'approved' | 'rejected';

const statusConfig = {
  pending: { icon: Clock, label: 'Pending', className: 'bg-warning/15 text-warning' },
  approved: { icon: CheckCircle2, label: 'Approved', className: 'bg-success/15 text-success' },
  rejected: { icon: XCircle, label: 'Rejected', className: 'bg-destructive/15 text-destructive' },
  draft: { icon: AlertCircle, label: 'Draft', className: 'bg-muted text-muted-foreground' },
};

const fmt = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const Approvals = () => {
  const [filter, setFilter] = useState<FilterStatus>('pending');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rejectionNotes, setRejectionNotes] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const invoices = filter === 'all' ? mockInvoices : mockInvoices.filter(i => i.status === filter);
  const pendingCount = mockInvoices.filter(i => i.status === 'pending').length;

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    // TODO: wire to DB
    setTimeout(() => setActionLoading(null), 800);
  };

  const handleReject = async (id: string) => {
    setActionLoading(id);
    // TODO: wire to DB
    setTimeout(() => setActionLoading(null), 800);
  };

  const toggle = (id: string) => setExpandedId(prev => prev === id ? null : id);

  return (
    <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold">Invoice Approvals</h2>
          <p className="text-sm text-muted-foreground font-body mt-1">
            {pendingCount} invoice{pendingCount !== 1 ? 's' : ''} awaiting review
          </p>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2">
        {([
          { value: 'pending' as FilterStatus, label: `Pending (${mockInvoices.filter(i => i.status === 'pending').length})` },
          { value: 'approved' as FilterStatus, label: 'Approved' },
          { value: 'rejected' as FilterStatus, label: 'Rejected' },
          { value: 'all' as FilterStatus, label: 'All' },
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
      {invoices.length === 0 ? (
        <div className="card-elevated p-12 text-center text-muted-foreground font-body">
          No invoices match this filter.
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {invoices.map((inv, i) => {
              const project = mockProjects.find(p => p.id === inv.projectId);
              const status = statusConfig[inv.status];
              const StatusIcon = status.icon;
              const expanded = expandedId === inv.id;

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
                        <span className="text-xs text-muted-foreground font-body">Draw: {inv.payrollDrawDate}</span>
                      </div>
                      <h3 className="font-display font-semibold text-base">{inv.crewName}</h3>
                      <p className="text-sm text-muted-foreground font-body">{project?.name} — {inv.projectAddress}</p>
                    </div>
                    <div className="flex items-center gap-4 ml-4">
                      <p className="font-display font-bold text-xl">{fmt(inv.totals.total)}</p>
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
                              { label: 'SOW Draw', value: inv.totals.sowDraw, icon: FileText },
                              { label: 'Day Labor', value: inv.totals.dayRateLabor, icon: Hammer },
                              { label: 'Reimbursements', value: inv.totals.reimbursement, icon: Receipt },
                              { label: 'Change Orders', value: inv.totals.changeOrders, icon: ArrowRightLeft },
                              { label: 'Credits', value: inv.totals.credits, icon: DollarSign },
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

                          {/* Line Items */}
                          {inv.lineItems.length > 0 && (
                            <div>
                              <h4 className="font-display font-semibold text-sm mb-2 flex items-center gap-1.5">
                                <FileText className="w-4 h-4 text-primary" /> SOW Line Items
                              </h4>
                              <div className="rounded-lg border border-border overflow-hidden">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="bg-muted/50">
                                      <th className="text-left p-2.5 font-display font-semibold text-xs text-muted-foreground">#</th>
                                      <th className="text-left p-2.5 font-display font-semibold text-xs text-muted-foreground">Description</th>
                                      <th className="text-right p-2.5 font-display font-semibold text-xs text-muted-foreground">Contract</th>
                                      <th className="text-right p-2.5 font-display font-semibold text-xs text-muted-foreground">% Complete</th>
                                      <th className="text-right p-2.5 font-display font-semibold text-xs text-muted-foreground">Draw</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {inv.lineItems.map((li, idx) => (
                                      <tr key={li.id || idx} className="border-t border-border/50">
                                        <td className="p-2.5 font-body text-muted-foreground">{li.lineItemNo || idx + 1}</td>
                                        <td className="p-2.5 font-body">{li.description}</td>
                                        <td className="p-2.5 text-right font-body">{fmt(li.contractPrice)}</td>
                                        <td className="p-2.5 text-right font-body">{li.percentComplete}%</td>
                                        <td className="p-2.5 text-right font-display font-semibold">{fmt(li.drawAmount)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          {/* Day Labor */}
                          {inv.dayLabor.length > 0 && (
                            <div>
                              <h4 className="font-display font-semibold text-sm mb-2 flex items-center gap-1.5">
                                <Hammer className="w-4 h-4 text-accent" /> Day Labor
                              </h4>
                              <div className="rounded-lg border border-border overflow-hidden">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="bg-muted/50">
                                      <th className="text-left p-2.5 font-display font-semibold text-xs text-muted-foreground">Day</th>
                                      <th className="text-left p-2.5 font-display font-semibold text-xs text-muted-foreground">Crew/Notes</th>
                                      <th className="text-right p-2.5 font-display font-semibold text-xs text-muted-foreground">Hours</th>
                                      <th className="text-right p-2.5 font-display font-semibold text-xs text-muted-foreground">Amount</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {inv.dayLabor.map((dl, idx) => (
                                      <tr key={idx} className="border-t border-border/50">
                                        <td className="p-2.5 font-body">{dl.day}</td>
                                        <td className="p-2.5 font-body text-muted-foreground">{dl.crewMembers}</td>
                                        <td className="p-2.5 text-right font-body">{dl.hours || '-'}</td>
                                        <td className="p-2.5 text-right font-display font-semibold">{fmt(dl.amount)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          {/* Reimbursements */}
                          {inv.reimbursements.length > 0 && (
                            <div>
                              <h4 className="font-display font-semibold text-sm mb-2 flex items-center gap-1.5">
                                <Receipt className="w-4 h-4 text-info" /> Reimbursements
                              </h4>
                              <div className="rounded-lg border border-border overflow-hidden">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="bg-muted/50">
                                      <th className="text-left p-2.5 font-display font-semibold text-xs text-muted-foreground">Date</th>
                                      <th className="text-left p-2.5 font-display font-semibold text-xs text-muted-foreground">Store</th>
                                      <th className="text-left p-2.5 font-display font-semibold text-xs text-muted-foreground">Description</th>
                                      <th className="text-right p-2.5 font-display font-semibold text-xs text-muted-foreground">Amount</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {inv.reimbursements.map((r, idx) => (
                                      <tr key={idx} className="border-t border-border/50">
                                        <td className="p-2.5 font-body">{r.date}</td>
                                        <td className="p-2.5 font-body">{r.store}</td>
                                        <td className="p-2.5 font-body text-muted-foreground">{r.description}</td>
                                        <td className="p-2.5 text-right font-display font-semibold">{fmt(r.amount)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          {/* Change Orders & Credits */}
                          {(inv.changeOrders.length > 0 || inv.credits.length > 0) && (
                            <div>
                              <h4 className="font-display font-semibold text-sm mb-2 flex items-center gap-1.5">
                                <ArrowRightLeft className="w-4 h-4 text-warning" /> Change Orders & Credits
                              </h4>
                              <div className="rounded-lg border border-border overflow-hidden">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="bg-muted/50">
                                      <th className="text-left p-2.5 font-display font-semibold text-xs text-muted-foreground">Type</th>
                                      <th className="text-left p-2.5 font-display font-semibold text-xs text-muted-foreground">Description</th>
                                      <th className="text-right p-2.5 font-display font-semibold text-xs text-muted-foreground">Qty</th>
                                      <th className="text-right p-2.5 font-display font-semibold text-xs text-muted-foreground">Amount</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {inv.changeOrders.map((co, idx) => (
                                      <tr key={`co-${idx}`} className="border-t border-border/50">
                                        <td className="p-2.5 font-body"><span className="px-2 py-0.5 rounded text-xs bg-warning/15 text-warning font-medium">CO</span></td>
                                        <td className="p-2.5 font-body">{co.description}</td>
                                        <td className="p-2.5 text-right font-body">{co.quantity}</td>
                                        <td className="p-2.5 text-right font-display font-semibold">{fmt(co.amount)}</td>
                                      </tr>
                                    ))}
                                    {inv.credits.map((cr, idx) => (
                                      <tr key={`cr-${idx}`} className="border-t border-border/50">
                                        <td className="p-2.5 font-body"><span className="px-2 py-0.5 rounded text-xs bg-destructive/15 text-destructive font-medium">Credit</span></td>
                                        <td className="p-2.5 font-body">{cr.description}</td>
                                        <td className="p-2.5 text-right font-body">{cr.quantity}</td>
                                        <td className="p-2.5 text-right font-display font-semibold">{fmt(cr.amount)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          {/* Rejection notes (if rejected) */}
                          {inv.status === 'rejected' && inv.rejectionNotes && (
                            <div className="bg-destructive/5 border border-destructive/15 rounded-lg p-4">
                              <p className="text-sm font-medium text-destructive mb-1">Rejection Reason:</p>
                              <p className="text-sm text-destructive/80 font-body">{inv.rejectionNotes}</p>
                            </div>
                          )}

                          {/* Grand total */}
                          <div className="flex items-center justify-between bg-secondary/10 rounded-lg p-4">
                            <span className="font-display font-semibold text-lg">Invoice Total</span>
                            <span className="font-display font-bold text-2xl">{fmt(inv.totals.total)}</span>
                          </div>

                          {/* Actions for pending invoices */}
                          {inv.status === 'pending' && (
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
                                  disabled={actionLoading === inv.id}
                                >
                                  {actionLoading === inv.id ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
                                  Approve Invoice
                                </Button>
                                <Button
                                  variant="outline"
                                  className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/5 font-display"
                                  onClick={() => handleReject(inv.id)}
                                  disabled={actionLoading === inv.id || !rejectionNotes[inv.id]?.trim()}
                                >
                                  {actionLoading === inv.id ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <XCircle className="w-4 h-4 mr-1" />}
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
