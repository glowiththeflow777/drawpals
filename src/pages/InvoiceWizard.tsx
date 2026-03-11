import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, ChevronLeft, ChevronRight, Check, Upload, Plus, Trash2, UserPlus, Loader2, CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format, nextTuesday, addWeeks, startOfDay } from 'date-fns';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useProjects, useTeamMembers, useCreateTeamMember, useBudgetLineItems, useSubcontractorDirectory, useCreateInvoice, useProjectAssignments, useBillingHistory } from '@/hooks/useProjects';
import { useCurrentUser } from '@/hooks/useAuth';
// BudgetLineItemSearch no longer used in step 3 — replaced with full checklist
import type { InvoiceLineItem, DayLaborEntry, ReimbursementEntry, ChangeOrderEntry } from '@/types/budget';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/use-toast';

const InvoiceWizard = () => {
  const navigate = useNavigate();
  const { data: dbProjects = [] } = useProjects();
  const { data: teamMembers = [] } = useTeamMembers();
  const { data: directoryEntries = [] } = useSubcontractorDirectory();
  const createTeamMember = useCreateTeamMember();
  const createInvoice = useCreateInvoice();
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const isAdminEntry = searchParams.get('admin') === 'true';
  const preselectedProject = searchParams.get('project') || '';

  const DAYS = [
    t('invoiceWizard.days.Saturday'),
    t('invoiceWizard.days.Sunday'),
    t('invoiceWizard.days.Monday'),
    t('invoiceWizard.days.Tuesday'),
    t('invoiceWizard.days.Wednesday'),
    t('invoiceWizard.days.Thursday'),
    t('invoiceWizard.days.Friday')
  ];

  const STEPS = [
    { id: 1, title: t('invoiceWizard.steps.project'), desc: t('invoiceWizard.stepDesc.project') },
    { id: 2, title: t('invoiceWizard.steps.header'), desc: t('invoiceWizard.stepDesc.header') },
    { id: 3, title: t('invoiceWizard.steps.lineItems'), desc: t('invoiceWizard.stepDesc.lineItems') },
    { id: 4, title: t('invoiceWizard.steps.dayLabor'), desc: t('invoiceWizard.stepDesc.dayLabor') },
    { id: 5, title: t('invoiceWizard.steps.reimburse'), desc: t('invoiceWizard.stepDesc.reimburse') },
    { id: 6, title: t('invoiceWizard.steps.changes'), desc: t('invoiceWizard.stepDesc.changes') },
    { id: 7, title: t('invoiceWizard.steps.attach'), desc: t('invoiceWizard.stepDesc.attach') },
    { id: 8, title: t('invoiceWizard.steps.review'), desc: t('invoiceWizard.stepDesc.review') },
  ];

  const [step, setStep] = useState(1);
  const [projectId, setProjectId] = useState(preselectedProject);
  const { data: projectBudgetItems = [] } = useBudgetLineItems(projectId || undefined);
  const { data: projectAssignments = [] } = useProjectAssignments(projectId || undefined);
  const { data: billingHistory = new Map() } = useBillingHistory(projectId || undefined);
  const [crewName, setCrewName] = useState(isAdminEntry ? '' : "Gloria's Crew");
  const [selectedSubcontractor, setSelectedSubcontractor] = useState('');
  const [drawDate, setDrawDate] = useState('');
  const [lineItems, setLineItems] = useState<Partial<InvoiceLineItem>[]>([]);
  const [dayLabor, setDayLabor] = useState<DayLaborEntry[]>(
    DAYS.map(d => ({ day: d, crewMembers: '', amount: 0, hours: 0 }))
  );
  const [reimbursements, setReimbursements] = useState<Partial<ReimbursementEntry>[]>([]);
  const [changeOrders, setChangeOrders] = useState<Partial<ChangeOrderEntry>[]>([]);
  const [credits, setCredits] = useState<Partial<ChangeOrderEntry>[]>([]);
  const [showNewSubForm, setShowNewSubForm] = useState(false);
  const [creatingNewSub, setCreatingNewSub] = useState(false);
  const [newSubForm, setNewSubForm] = useState({ name: '', email: '', phone: '', crew_name: '' });
  const [attachments, setAttachments] = useState<File[]>([]);

  const project = dbProjects.find(p => p.id === projectId);

  const updateLineItem = (idx: number, field: string, value: string | number) => {
    const updated = [...lineItems];
    (updated[idx] as any)[field] = value;
    if (field === 'percentComplete' || field === 'contractPrice') {
      const cp = field === 'contractPrice' ? Number(value) : (updated[idx].contractPrice || 0);
      const pc = field === 'percentComplete' ? Number(value) : (updated[idx].percentComplete || 0);
      updated[idx].drawAmount = Math.round(cp * pc / 100 * 100) / 100;
    }
    setLineItems(updated);
  };

  const sowTotal = lineItems.reduce((s, li) => s + (li.drawAmount || 0), 0);
  const dayLaborTotal = dayLabor.reduce((s, d) => s + (d.amount || 0), 0);
  const reimbTotal = reimbursements.reduce((s, r) => s + (r.amount || 0), 0);
  const coTotal = changeOrders.reduce((s, c) => s + (c.amount || 0), 0);
  const creditTotal = credits.reduce((s, c) => s + (c.amount || 0), 0);
  const grandTotal = sowTotal + dayLaborTotal + reimbTotal + coTotal - Math.abs(creditTotal);

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user || !projectId) return;
    setSubmitting(true);
    try {
      await createInvoice.mutateAsync({
        project_id: projectId,
        submitted_by: user.id,
        subcontractor_name: selectedSubcontractor || crewName,
        invoice_number: `INV-${Date.now()}`,
        invoice_date: drawDate || new Date().toISOString().split('T')[0],
        sow_total: sowTotal,
        day_labor_total: dayLaborTotal,
        reimbursement_total: reimbTotal,
        change_order_total: coTotal,
        credit_total: creditTotal,
        grand_total: grandTotal,
        notes: '',
      });
      toast({ title: 'Invoice submitted', description: `$${grandTotal.toLocaleString()} invoice saved successfully.` });
      navigate(isAdminEntry ? '/admin/invoices' : '/dashboard');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const canNext = () => {
    if (step === 1) return !!projectId;
    if (step === 2) return !!crewName && !!drawDate;
    return true;
  };

  return (
    <>
      {/* Progress */}
      <div className="px-4 pt-6 pb-2 max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <Link to="/dashboard" className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-1">
            <ChevronLeft className="w-4 h-4" /> {t('common.cancel')}
          </Link>
          <span className="text-xs text-muted-foreground font-body">{t('invoiceWizard.stepOf', { step: step })}</span>
        </div>
        <div className="flex gap-1">
          {STEPS.map(s => (
            <div
              key={s.id}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                s.id < step ? 'bg-accent' : s.id === step ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>
        <div className="flex items-center justify-between mt-2">
          <p className="font-display font-semibold">{STEPS[step - 1].title}</p>
          <p className="text-xs text-muted-foreground">{STEPS[step - 1].desc}</p>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 pb-32">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="mt-4"
          >
            {step === 1 && (
              <div className="space-y-3">
                <p className="text-muted-foreground font-body text-sm">{t('invoiceWizard.step1.question')}</p>
                {dbProjects.filter(p => p.status === 'active').map(p => {
                  const selected = projectId === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setProjectId(p.id)}
                      className={`w-full text-left card-elevated p-4 transition-all rounded-lg border-2 ${
                        selected
                          ? 'border-primary bg-primary/10 ring-1 ring-primary shadow-md'
                          : 'border-transparent hover:border-primary/40 hover:bg-accent/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-display font-semibold">{p.name}</p>
                        {selected && (
                          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                            <Check className="w-3 h-3 text-primary-foreground" />
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{p.address}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t('common.budget')}: ${p.total_budget.toLocaleString()}</p>
                    </button>
                  );
                })}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                {isAdminEntry && (
                  <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 mb-2">
                    <p className="text-xs font-display font-semibold text-warning">{t('invoiceWizard.step2.adminEntry')}</p>
                  </div>
                )}
                <div className="space-y-3">
                    <Label className="font-body">{t('invoiceWizard.step2.selectSubcontractor')}</Label>
                    <Select value={selectedSubcontractor} onValueChange={(val) => {
                      if (val === '__new__') {
                        setShowNewSubForm(true);
                        return;
                      }
                      setSelectedSubcontractor(val);
                      setCrewName(val);
                      setShowNewSubForm(false);
                    }}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder={t('invoiceWizard.step2.chooseSubcontractor')} />
                      </SelectTrigger>
                      <SelectContent>
                        {/* Team member subcontractors */}
                        {teamMembers.filter(m => m.role === 'subcontractor').map(m => (
                          <SelectItem key={`tm-${m.id}`} value={m.crew_name || m.name}>
                            {m.crew_name || m.name}
                          </SelectItem>
                        ))}
                        {/* Directory subcontractors (exclude duplicates by name) */}
                        {directoryEntries
                          .filter(d => {
                            const teamNames = teamMembers
                              .filter(m => m.role === 'subcontractor')
                              .map(m => (m.crew_name || m.name).toLowerCase());
                            return !teamNames.includes(d.company_name.toLowerCase());
                          })
                          .map(d => (
                            <SelectItem key={`dir-${d.id}`} value={d.company_name}>
                              {d.company_name}{d.contact_name ? ` (${d.contact_name})` : ''}
                            </SelectItem>
                          ))}
                        <SelectItem value="__new__">
                          <span className="flex items-center gap-1.5">
                            <UserPlus className="w-3.5 h-3.5" /> Add New Subcontractor
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>

                    {showNewSubForm && (
                      <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/30">
                        <p className="text-sm font-display font-semibold">New Subcontractor</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs font-body">Name *</Label>
                            <Input
                              className="mt-1"
                              placeholder="Contact name"
                              value={newSubForm.name}
                              onChange={e => setNewSubForm(f => ({ ...f, name: e.target.value }))}
                            />
                          </div>
                          <div>
                            <Label className="text-xs font-body">Crew Name</Label>
                            <Input
                              className="mt-1"
                              placeholder="Crew / company name"
                              value={newSubForm.crew_name}
                              onChange={e => setNewSubForm(f => ({ ...f, crew_name: e.target.value }))}
                            />
                          </div>
                          <div>
                            <Label className="text-xs font-body">Email *</Label>
                            <Input
                              type="email"
                              className="mt-1"
                              placeholder="email@example.com"
                              value={newSubForm.email}
                              onChange={e => setNewSubForm(f => ({ ...f, email: e.target.value }))}
                            />
                          </div>
                          <div>
                            <Label className="text-xs font-body">Phone</Label>
                            <Input
                              className="mt-1"
                              placeholder="512-555-0000"
                              value={newSubForm.phone}
                              onChange={e => setNewSubForm(f => ({ ...f, phone: e.target.value }))}
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            disabled={creatingNewSub || !newSubForm.name.trim() || !newSubForm.email.trim()}
                            onClick={async () => {
                              setCreatingNewSub(true);
                              try {
                                const created = await createTeamMember.mutateAsync({
                                  name: newSubForm.name,
                                  email: newSubForm.email,
                                  phone: newSubForm.phone,
                                  crew_name: newSubForm.crew_name || null,
                                  role: 'subcontractor',
                                });
                                const displayName = created.crew_name || created.name;
                                setSelectedSubcontractor(displayName);
                                setCrewName(displayName);
                                setShowNewSubForm(false);
                                setNewSubForm({ name: '', email: '', phone: '', crew_name: '' });
                                toast({ title: 'Subcontractor added', description: `${displayName} has been created.` });
                              } catch (e: any) {
                                toast({ title: 'Error', description: e.message, variant: 'destructive' });
                              } finally {
                                setCreatingNewSub(false);
                              }
                            }}
                          >
                            {creatingNewSub ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                            Add
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setShowNewSubForm(false)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                <div>
                  <Label className="font-body">{t('invoiceWizard.step2.projectManager', 'Project Manager')}</Label>
                  {(() => {
                    const pmAssignments = projectAssignments.filter(
                      (a: any) => a.team_members?.role === 'project-manager'
                    );
                    if (pmAssignments.length === 0) {
                      return <p className="text-sm text-muted-foreground mt-1">No project managers assigned to this project.</p>;
                    }
                    return (
                      <Select value={crewName} onValueChange={setCrewName}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select a project manager..." />
                        </SelectTrigger>
                        <SelectContent>
                          {pmAssignments.map((a: any) => (
                            <SelectItem key={a.team_members.id} value={a.team_members.name}>
                              {a.team_members.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    );
                  })()}
                </div>
                <div>
                  <Label className="font-body">{t('invoiceWizard.step2.projectAddress')}</Label>
                  <Input value={project?.address || ''} readOnly className="mt-1 bg-muted" />
                </div>
                <div>
                  <Label className="font-body">{t('invoiceWizard.step2.payrollDrawDate')}</Label>
                  <p className="text-xs text-muted-foreground mb-1.5">Only Tuesdays are available — invoices must be submitted by Tuesday at 10:00 AM.</p>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal mt-1",
                          !drawDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {drawDate ? format(new Date(drawDate + 'T00:00:00'), 'PPP') : <span>Select a Tuesday</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={drawDate ? new Date(drawDate + 'T00:00:00') : undefined}
                        onSelect={(date) => {
                          if (date) setDrawDate(format(date, 'yyyy-MM-dd'));
                        }}
                        disabled={(date) => {
                          // Only allow Tuesdays (day 2) that are today or in the future
                          return date.getDay() !== 2 || startOfDay(date) < startOfDay(new Date());
                        }}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <p className="text-muted-foreground font-body text-sm">
                  Tap each budget line item you're billing for, then set the % complete.
                </p>

                {projectBudgetItems.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground font-body">No budget items found for this project.</p>
                  </div>
                ) : (() => {
                  // Group by cost_group
                  const groups = new Map<string, typeof projectBudgetItems>();
                  projectBudgetItems.forEach(item => {
                    const group = item.cost_group || 'Ungrouped';
                    if (!groups.has(group)) groups.set(group, []);
                    groups.get(group)!.push(item);
                  });

                  const selectedIds = new Set(lineItems.map(li => (li as any).budgetItemId));

                  return (
                    <div className="space-y-3">
                      {Array.from(groups.entries()).map(([group, items]) => (
                        <div key={group} className="border border-border rounded-lg overflow-hidden">
                          <div className="bg-muted/30 px-4 py-2.5 flex items-center justify-between">
                            <span className="font-display font-semibold text-sm">{group}</span>
                            <span className="text-xs text-muted-foreground">{items.length} items</span>
                          </div>
                          <div className="divide-y divide-border/50">
                            {items.map(item => {
                              const isSelected = selectedIds.has(item.id);
                              const liIdx = lineItems.findIndex(li => (li as any).budgetItemId === item.id);

                              return (
                                <div key={item.id}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (isSelected) {
                                        setLineItems(prev => prev.filter(li => (li as any).budgetItemId !== item.id));
                                      } else {
                                        setLineItems(prev => [
                                          ...prev,
                                          {
                                            budgetItemId: item.id,
                                            lineItemNo: item.line_item_no,
                                            description: `${item.cost_item_name}${item.cost_type ? ` (${item.cost_type})` : ''}`,
                                            contractPrice: Number(item.extended_cost),
                                            percentComplete: 0,
                                            drawAmount: 0,
                                          } as any,
                                        ]);
                                      }
                                    }}
                                    className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
                                      isSelected ? 'bg-primary/10' : 'hover:bg-muted/40'
                                    }`}
                                  >
                                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                      isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/40'
                                    }`}>
                                      {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center justify-between">
                                        <span className="font-display text-sm font-medium">
                                          <span className="text-muted-foreground mr-1.5">#{item.line_item_no}</span>
                                          {item.cost_item_name}
                                          {item.cost_type && (
                                            <span className="text-xs text-muted-foreground ml-1.5">({item.cost_type})</span>
                                          )}
                                        </span>
                                        <span className="text-xs font-display font-semibold ml-2 flex-shrink-0">
                                          ${Number(item.extended_cost).toLocaleString()}
                                        </span>
                                      </div>
                                      {item.description && item.description !== item.cost_item_name && (
                                        <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                                      )}
                                    </div>
                                  </button>
                                  {isSelected && liIdx >= 0 && (
                                    <div className="px-4 pb-3 pt-1 bg-primary/5 flex items-center gap-3" onClick={e => e.stopPropagation()}>
                                      <div className="flex-1">
                                        <Label className="text-xs font-body">{t('invoiceWizard.step3.percentComplete')}</Label>
                                        <Input
                                          type="number"
                                          min="0"
                                          max="100"
                                          placeholder="0"
                                          className="mt-1 h-8 text-sm"
                                          value={lineItems[liIdx]?.percentComplete || ''}
                                          onChange={e => updateLineItem(liIdx, 'percentComplete', Number(e.target.value))}
                                        />
                                      </div>
                                      <div className="flex-1">
                                        <Label className="text-xs font-body">{t('invoiceWizard.step3.drawAmount')}</Label>
                                        <Input
                                          type="number"
                                          readOnly
                                          className="mt-1 h-8 text-sm bg-muted font-semibold"
                                          value={lineItems[liIdx]?.drawAmount || 0}
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}

                      {/* Summary */}
                      <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                        <span className="font-display text-sm font-medium">
                          {lineItems.filter(li => (li as any).budgetItemId).length} items selected
                        </span>
                        <span className="font-display font-bold text-lg">{t('invoiceWizard.step3.sowTotal')}: ${sowTotal.toLocaleString()}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {step === 4 && (
              <div className="space-y-3">
                <p className="text-muted-foreground font-body text-sm">{t('invoiceWizard.step4.instruction')}</p>
                {dayLabor.map((dl, idx) => (
                  <div key={dl.day} className="card-elevated p-3">
                    <p className="font-display font-semibold text-sm mb-2">{dl.day}</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-1">
                        <Label className="text-xs font-body">{t('invoiceWizard.step4.crew')}</Label>
                        <Input placeholder={t('invoiceWizard.step4.crewPlaceholder')} className="mt-1 text-sm" value={dl.crewMembers} onChange={e => {
                          const u = [...dayLabor]; u[idx].crewMembers = e.target.value; setDayLabor(u);
                        }} />
                      </div>
                      <div>
                        <Label className="text-xs font-body">{t('invoiceWizard.step4.dollarAmount')}</Label>
                        <Input type="number" placeholder="0" className="mt-1 text-sm" value={dl.amount || ''} onChange={e => {
                          const u = [...dayLabor]; u[idx].amount = Number(e.target.value); setDayLabor(u);
                        }} />
                      </div>
                      <div>
                        <Label className="text-xs font-body">{t('invoiceWizard.step4.hours')}</Label>
                        <Input type="number" placeholder="0" className="mt-1 text-sm" value={dl.hours || ''} onChange={e => {
                          const u = [...dayLabor]; u[idx].hours = Number(e.target.value); setDayLabor(u);
                        }} />
                      </div>
                    </div>
                  </div>
                ))}
                <div className="text-right font-display font-bold text-lg">{t('invoiceWizard.step4.dayLaborTotal')}: ${dayLaborTotal.toLocaleString()}</div>
              </div>
            )}

            {step === 5 && (
              <div className="space-y-4">
                <p className="text-muted-foreground font-body text-sm">{t('invoiceWizard.step5.instruction')}</p>
                {reimbursements.map((r, idx) => (
                  <div key={idx} className="card-elevated p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-display font-semibold text-sm">{t('invoiceWizard.step5.receipt')} {idx + 1}</span>
                      <button onClick={() => setReimbursements(reimbursements.filter((_, i) => i !== idx))} className="text-destructive"><Trash2 className="w-4 h-4" /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs font-body">{t('common.date')}</Label>
                        <Input type="date" className="mt-1" onChange={e => { const u = [...reimbursements]; u[idx].date = e.target.value; setReimbursements(u); }} />
                      </div>
                      <div>
                        <Label className="text-xs font-body">{t('invoiceWizard.step5.store')}</Label>
                        <Input placeholder={t('invoiceWizard.step5.storePlaceholder')} className="mt-1" onChange={e => { const u = [...reimbursements]; u[idx].store = e.target.value; setReimbursements(u); }} />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs font-body">{t('common.description')}</Label>
                      <Input placeholder={t('invoiceWizard.step5.purchasedPlaceholder')} className="mt-1" onChange={e => { const u = [...reimbursements]; u[idx].description = e.target.value; setReimbursements(u); }} />
                    </div>
                    <div>
                      <Label className="text-xs font-body">{t('invoiceWizard.step4.dollarAmount')}</Label>
                      <Input type="number" placeholder="0" className="mt-1" onChange={e => { const u = [...reimbursements]; u[idx].amount = Number(e.target.value); setReimbursements(u); }} />
                    </div>
                  </div>
                ))}
                <Button variant="outline" className="w-full" onClick={() => setReimbursements([...reimbursements, { date: '', store: '', description: '', amount: 0 }])}>
                  <Plus className="w-4 h-4 mr-2" /> {t('invoiceWizard.step5.addReimbursement')}
                </Button>
                <div className="text-right font-display font-bold text-lg">{t('invoiceWizard.step5.reimbTotal')}: ${reimbTotal.toLocaleString()}</div>
              </div>
            )}

            {step === 6 && (
              <div className="space-y-6">
                {/* Change Orders */}
                <div>
                  <h3 className="font-display font-semibold mb-3">Change Orders (Additions)</h3>
                  {changeOrders.map((co, idx) => (
                    <div key={idx} className="card-elevated p-3 mb-2 space-y-2">
                      <div className="flex justify-between"><span className="text-sm font-display">CO {idx+1}</span><button onClick={() => setChangeOrders(changeOrders.filter((_,i) => i!==idx))} className="text-destructive"><Trash2 className="w-4 h-4" /></button></div>
                      <div className="grid grid-cols-3 gap-2">
                        <div><Label className="text-xs">Qty</Label><Input type="number" className="mt-1" onChange={e => { const u=[...changeOrders]; u[idx].quantity=Number(e.target.value); setChangeOrders(u); }} /></div>
                        <div className="col-span-1"><Label className="text-xs">Description</Label><Input className="mt-1" onChange={e => { const u=[...changeOrders]; u[idx].description=e.target.value; setChangeOrders(u); }} /></div>
                        <div><Label className="text-xs">$ Amount</Label><Input type="number" className="mt-1" onChange={e => { const u=[...changeOrders]; u[idx].amount=Number(e.target.value); setChangeOrders(u); }} /></div>
                      </div>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="w-full" onClick={() => setChangeOrders([...changeOrders, { quantity: 1, description: '', amount: 0 }])}>
                    <Plus className="w-4 h-4 mr-1" /> Add Change Order
                  </Button>
                </div>
                {/* Credits */}
                <div>
                  <h3 className="font-display font-semibold mb-3">Credits (Deductions)</h3>
                  {credits.map((cr, idx) => (
                    <div key={idx} className="card-elevated p-3 mb-2 space-y-2">
                      <div className="flex justify-between"><span className="text-sm font-display">Credit {idx+1}</span><button onClick={() => setCredits(credits.filter((_,i) => i!==idx))} className="text-destructive"><Trash2 className="w-4 h-4" /></button></div>
                      <div className="grid grid-cols-3 gap-2">
                        <div><Label className="text-xs">Qty</Label><Input type="number" className="mt-1" onChange={e => { const u=[...credits]; u[idx].quantity=Number(e.target.value); setCredits(u); }} /></div>
                        <div className="col-span-1"><Label className="text-xs">Description</Label><Input className="mt-1" onChange={e => { const u=[...credits]; u[idx].description=e.target.value; setCredits(u); }} /></div>
                        <div><Label className="text-xs">$ Amount</Label><Input type="number" className="mt-1" onChange={e => { const u=[...credits]; u[idx].amount=Number(e.target.value); setCredits(u); }} /></div>
                      </div>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="w-full" onClick={() => setCredits([...credits, { quantity: 1, description: '', amount: 0 }])}>
                    <Plus className="w-4 h-4 mr-1" /> Add Credit
                  </Button>
                </div>
                <div className="text-right space-y-1">
                  <p className="font-body text-sm text-muted-foreground">Change Orders: ${coTotal.toLocaleString()}</p>
                  <p className="font-body text-sm text-muted-foreground">Credits: -${Math.abs(creditTotal).toLocaleString()}</p>
                </div>
              </div>
            )}

            {step === 7 && (
              <div className="space-y-4">
                <p className="text-muted-foreground font-body text-sm">Upload photos and receipt scans</p>
                <div className="relative border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary transition-colors cursor-pointer">
                  <input
                    type="file"
                    multiple
                    accept="image/*,.pdf,.doc,.docx,.xlsx,.xls,.csv,.txt,.rtf,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                    onChange={(e) => {
                      const files = e.target.files;
                      if (files && files.length > 0) {
                        setAttachments(prev => [...prev, ...Array.from(files)]);
                      }
                      e.target.value = '';
                    }}
                  />
                  <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                  <p className="font-display font-semibold">Tap to upload files</p>
                  <p className="text-xs text-muted-foreground mt-1">Photos, receipts, PDFs</p>
                </div>
                {attachments.length > 0 && (
                  <div className="space-y-2">
                    {attachments.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 rounded-lg border border-border">
                        <div className="flex items-center gap-2 min-w-0">
                          <Upload className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <span className="text-sm font-body truncate">{file.name}</span>
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            {(file.size / 1024).toFixed(0)} KB
                          </span>
                        </div>
                        <button
                          onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                          className="text-destructive flex-shrink-0 ml-2"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground">{attachments.length} file(s) attached</p>
                  </div>
                )}
                <p className="text-xs text-muted-foreground text-center">Or connect to CompanyCam for job site photos</p>
              </div>
            )}

            {step === 8 && (
              <div className="space-y-4">
                <h3 className="font-display font-semibold text-lg">Invoice Summary</h3>
                <div className="card-elevated p-4 space-y-3">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Project</span><span className="font-semibold">{project?.name}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Crew</span><span>{crewName}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Draw Date</span><span>{drawDate}</span></div>
                  <hr className="border-border" />
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">SOW Draw</span><span>${sowTotal.toLocaleString()}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Day Rate Labor</span><span>${dayLaborTotal.toLocaleString()}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Reimbursements</span><span>${reimbTotal.toLocaleString()}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Change Orders</span><span>${coTotal.toLocaleString()}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Credits</span><span className="text-destructive">-${Math.abs(creditTotal).toLocaleString()}</span></div>
                  <hr className="border-border" />
                  <div className="flex justify-between text-lg font-display font-bold">
                    <span>Total</span>
                    <span className="text-gradient">${grandTotal.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border px-4 py-4">
        <div className="max-w-2xl mx-auto flex gap-3">
          {step > 1 && (
            <Button variant="outline" className="flex-1 py-6 font-display" onClick={() => setStep(step - 1)}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Back
            </Button>
          )}
          {step < 8 ? (
            <Button
              className="flex-1 py-6 font-display gradient-primary text-primary-foreground"
              onClick={() => setStep(step + 1)}
              disabled={!canNext()}
            >
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              className="flex-1 py-6 font-display gradient-primary text-primary-foreground text-lg"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Check className="w-5 h-5 mr-2" />} Submit Invoice
            </Button>
          )}
        </div>
      </div>
    </>
  );
};

export default InvoiceWizard;
