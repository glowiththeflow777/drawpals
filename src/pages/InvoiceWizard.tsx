import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, ChevronLeft, ChevronRight, Check, Upload, Plus, Trash2, UserPlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useProjects, useTeamMembers, useCreateTeamMember } from '@/hooks/useProjects';
import type { InvoiceLineItem, DayLaborEntry, ReimbursementEntry, ChangeOrderEntry } from '@/types/budget';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/use-toast';

const InvoiceWizard = () => {
  const navigate = useNavigate();
  const { data: dbProjects = [] } = useProjects();
  const { data: teamMembers = [] } = useTeamMembers();
  const createTeamMember = useCreateTeamMember();
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
  const [crewName, setCrewName] = useState(isAdminEntry ? '' : "Gloria's Crew");
  const [selectedSubcontractor, setSelectedSubcontractor] = useState('');
  const [drawDate, setDrawDate] = useState('');
  const [lineItems, setLineItems] = useState<Partial<InvoiceLineItem>[]>([
    { description: '', contractPrice: 0, percentComplete: 0, drawAmount: 0 },
  ]);
  const [dayLabor, setDayLabor] = useState<DayLaborEntry[]>(
    DAYS.map(d => ({ day: d, crewMembers: '', amount: 0, hours: 0 }))
  );
  const [reimbursements, setReimbursements] = useState<Partial<ReimbursementEntry>[]>([]);
  const [changeOrders, setChangeOrders] = useState<Partial<ChangeOrderEntry>[]>([]);
  const [credits, setCredits] = useState<Partial<ChangeOrderEntry>[]>([]);

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

  const handleSubmit = () => {
    navigate('/dashboard');
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
                {dbProjects.filter(p => p.status === 'active').map(p => (
                  <button
                    key={p.id}
                    onClick={() => setProjectId(p.id)}
                    className={`w-full text-left card-elevated p-4 transition-all ${projectId === p.id ? 'ring-2 ring-primary' : ''}`}
                  >
                    <p className="font-display font-semibold">{p.name}</p>
                    <p className="text-sm text-muted-foreground">{p.address}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t('common.budget')}: ${p.total_budget.toLocaleString()}</p>
                  </button>
                ))}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                {isAdminEntry && (
                  <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 mb-2">
                    <p className="text-xs font-display font-semibold text-warning">{t('invoiceWizard.step2.adminEntry')}</p>
                  </div>
                )}
                {isAdminEntry && (
                  <div>
                    <Label className="font-body">{t('invoiceWizard.step2.selectSubcontractor')}</Label>
                    <Select value={selectedSubcontractor} onValueChange={(val) => { setSelectedSubcontractor(val); setCrewName(val); }}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder={t('invoiceWizard.step2.chooseSubcontractor')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Gloria's Crew">Gloria's Crew</SelectItem>
                        <SelectItem value="Beckett's Team">Beckett's Team</SelectItem>
                        <SelectItem value="Rio Finishers">Rio Finishers</SelectItem>
                        <SelectItem value="Austin Interiors">Austin Interiors</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label className="font-body">{t('invoiceWizard.step2.crewName')}</Label>
                  <Input value={crewName} onChange={e => setCrewName(e.target.value)} className="mt-1" readOnly={isAdminEntry} />
                </div>
                <div>
                  <Label className="font-body">{t('invoiceWizard.step2.projectAddress')}</Label>
                  <Input value={project?.address || ''} readOnly className="mt-1 bg-muted" />
                </div>
                <div>
                  <Label className="font-body">{t('invoiceWizard.step2.payrollDrawDate')}</Label>
                  <Input type="date" value={drawDate} onChange={e => setDrawDate(e.target.value)} className="mt-1" />
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <p className="text-muted-foreground font-body text-sm">{t('invoiceWizard.step3.instruction')}</p>
                {lineItems.map((li, idx) => (
                  <div key={idx} className="card-elevated p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-display font-semibold text-sm">{t('invoiceWizard.step3.item')} {idx + 1}</span>
                      {lineItems.length > 1 && (
                        <button onClick={() => setLineItems(lineItems.filter((_, i) => i !== idx))} className="text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs font-body">{t('invoiceWizard.step3.lineItemNo')}</Label>
                      <Input type="number" placeholder="#" className="mt-1" onChange={e => updateLineItem(idx, 'lineItemNo', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs font-body">{t('common.description')}</Label>
                      <Input placeholder={t('invoiceWizard.step3.descriptionPlaceholder')} className="mt-1" value={li.description || ''} onChange={e => updateLineItem(idx, 'description', e.target.value)} />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs font-body">{t('invoiceWizard.step3.contractPrice')}</Label>
                        <Input type="number" placeholder="0" className="mt-1" value={li.contractPrice || ''} onChange={e => updateLineItem(idx, 'contractPrice', Number(e.target.value))} />
                      </div>
                      <div>
                        <Label className="text-xs font-body">{t('invoiceWizard.step3.percentComplete')}</Label>
                        <Input type="number" placeholder="0" min="0" max="100" className="mt-1" value={li.percentComplete || ''} onChange={e => updateLineItem(idx, 'percentComplete', Number(e.target.value))} />
                      </div>
                      <div>
                        <Label className="text-xs font-body">{t('invoiceWizard.step3.drawAmount')}</Label>
                        <Input type="number" readOnly className="mt-1 bg-muted font-semibold" value={li.drawAmount || 0} />
                      </div>
                    </div>
                  </div>
                ))}
                <Button variant="outline" className="w-full" onClick={() => setLineItems([...lineItems, { description: '', contractPrice: 0, percentComplete: 0, drawAmount: 0 }])}>
                  <Plus className="w-4 h-4 mr-2" /> {t('invoiceWizard.step3.addLineItem')}
                </Button>
                <div className="text-right font-display font-bold text-lg">{t('invoiceWizard.step3.sowTotal')}: ${sowTotal.toLocaleString()}</div>
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
                <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary transition-colors cursor-pointer">
                  <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                  <p className="font-display font-semibold">Tap to upload files</p>
                  <p className="text-xs text-muted-foreground mt-1">Photos, receipts, PDFs</p>
                </div>
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
            >
              <Check className="w-5 h-5 mr-2" /> Submit Invoice
            </Button>
          )}
        </div>
      </div>
    </>
  );
};

export default InvoiceWizard;
