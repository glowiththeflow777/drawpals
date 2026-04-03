import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import { Upload, ChevronRight, ChevronDown, HardHat, Loader2, ArrowRight, ArrowLeft, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useSubBudgets, useSubBudgetLineItems, useCreateSubBudget, useDeleteSubBudget } from '@/hooks/useProjects';
import type { DbTeamMember } from '@/hooks/useProjects';

// The internal field names we map spreadsheet columns to
const BUDGET_FIELDS = [
  { key: 'lineItemNo', label: 'Line Item #', required: false },
  { key: 'costGroup', label: 'Cost Group', required: false },
  { key: 'costItemName', label: 'Cost Item Name', required: true },
  { key: 'description', label: 'Description', required: false },
  { key: 'quantity', label: 'Quantity', required: false },
  { key: 'unit', label: 'Unit', required: false },
  { key: 'extendedCost', label: 'Extended Cost', required: true },
  { key: 'costType', label: 'Cost Type', required: false },
  { key: 'costCode', label: 'Cost Code', required: false },
] as const;

type FieldKey = typeof BUDGET_FIELDS[number]['key'];

interface ParsedLineItem {
  id: string;
  lineItemNo: number;
  costGroup: string;
  costItemName: string;
  description: string;
  quantity: number;
  unit: string;
  extendedCost: number;
  costType: string;
  costCode: string;
}

interface SubcontractorBudgetsProps {
  projectId: string;
  assignedMembers: DbTeamMember[];
  currentUserId: string;
}

// Auto-detect column mapping using regex patterns
function autoDetectMapping(headers: string[]): Record<FieldKey, string> {
  const fieldPatterns: [FieldKey, RegExp[]][] = [
    ['lineItemNo', [/^line\s*item\s*#?$/i, /^line\s*#?$/i, /^#$/i, /^no\.?$/i, /^number$/i]],
    ['costGroup', [/^cost\s*group$/i, /^group$/i, /^division$/i, /^category$/i, /^csi$/i]],
    ['costItemName', [/^cost\s*item\s*name$/i, /^item\s*name$/i, /^name$/i, /^trade$/i]],
    ['description', [/^description$/i, /^desc\.?$/i, /^scope$/i, /^work$/i, /^scope\s*of\s*work$/i]],
    ['quantity', [/^quantity$/i, /^qty\.?$/i]],
    ['unit', [/^unit$/i, /^uom$/i, /^unit\s*of\s*measure$/i]],
    ['extendedCost', [/^extended\s*cost$/i, /^ext\.?\s*cost$/i, /^amount$/i, /^total$/i, /^cost$/i, /^price$/i]],
    ['costType', [/^cost\s*type$/i, /^type$/i]],
    ['costCode', [/^cost\s*code$/i, /^code$/i]],
  ];
  const mapping: Record<string, string> = {};
  const used = new Set<string>();
  for (const [field, patterns] of fieldPatterns) {
    for (const pattern of patterns) {
      const match = headers.find(h => !used.has(h) && pattern.test(h.trim()));
      if (match) { mapping[field] = match; used.add(match); break; }
    }
  }
  return mapping as Record<FieldKey, string>;
}

function applyMapping(rows: Record<string, any>[], mapping: Record<FieldKey, string>): ParsedLineItem[] {
  const col = (f: FieldKey) => mapping[f] || '';
  return rows.map((row, idx) => {
    const cost = parseFloat(String(row[col('extendedCost')] ?? '').replace(/[^0-9.-]/g, '')) || 0;
    const lineNo = Number(row[col('lineItemNo')]);
    return {
      id: `p-${idx}`,
      lineItemNo: isNaN(lineNo) || lineNo === 0 ? idx + 1 : lineNo,
      costGroup: String(row[col('costGroup')] || ''),
      costItemName: String(row[col('costItemName')] || row[col('description')] || `Item ${idx + 1}`),
      description: String(row[col('description')] || ''),
      quantity: parseFloat(String(row[col('quantity')] ?? '').replace(/[^0-9.-]/g, '')) || 0,
      unit: String(row[col('unit')] || 'Each'),
      extendedCost: cost,
      costType: String(row[col('costType')] || 'Labor'),
      costCode: String(row[col('costCode')] || ''),
    };
  }).filter(i => i.costItemName || i.extendedCost > 0);
}

const SubcontractorBudgets: React.FC<SubcontractorBudgetsProps> = ({
  projectId,
  assignedMembers,
  currentUserId,
}) => {
  const { toast } = useToast();
  const { data: subBudgets = [] } = useSubBudgets(projectId);
  const createSubBudget = useCreateSubBudget();

  const [expanded, setExpanded] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedSubId, setSelectedSubId] = useState('');
  const [fileName, setFileName] = useState('');
  const [saving, setSaving] = useState(false);
  const [viewingBudgetId, setViewingBudgetId] = useState<string | null>(null);

  // Upload wizard steps: 1 = pick sub + file, 2 = column mapping, 3 = review/select items
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [spreadsheetHeaders, setSpreadsheetHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<FieldKey, string>>({} as any);
  const [parsedItems, setParsedItems] = useState<ParsedLineItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const resetUpload = () => {
    setUploadOpen(false);
    setWizardStep(1);
    setRawRows([]);
    setSpreadsheetHeaders([]);
    setColumnMapping({} as any);
    setParsedItems([]);
    setSelectedIds(new Set());
    setFileName('');
    setSelectedSubId('');
  };

  const parseFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        if (rows.length === 0) {
          toast({ title: 'Empty file', description: 'No rows found in the spreadsheet.', variant: 'destructive' });
          return;
        }
        const headers = Object.keys(rows[0]);
        setRawRows(rows);
        setSpreadsheetHeaders(headers);
        setColumnMapping(autoDetectMapping(headers));
        setWizardStep(2);
      } catch {
        toast({ title: 'Parse error', description: 'Could not read the file.', variant: 'destructive' });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleMappingConfirm = () => {
    const items = applyMapping(rawRows, columnMapping);
    setParsedItems(items);
    setSelectedIds(new Set(items.map(i => i.id)));
    setWizardStep(3);
  };

  // Preview of mapping: show first 3 rows mapped
  const mappingPreview = useMemo(() => {
    if (rawRows.length === 0) return [];
    return applyMapping(rawRows.slice(0, 3), columnMapping);
  }, [rawRows, columnMapping]);

  const handleUpload = async () => {
    if (!selectedSubId || parsedItems.length === 0) return;
    const selected = parsedItems.filter(i => selectedIds.has(i.id));
    if (selected.length === 0) return;
    setSaving(true);
    try {
      await createSubBudget.mutateAsync({
        project_id: projectId,
        team_member_id: selectedSubId,
        uploaded_by: currentUserId,
        file_name: fileName,
        line_items: selected.map(i => ({
          line_item_no: i.lineItemNo,
          cost_group: i.costGroup,
          cost_item_name: i.costItemName,
          description: i.description,
          quantity: i.quantity,
          unit: i.unit,
          extended_cost: i.extendedCost,
          cost_type: i.costType,
          cost_code: i.costCode,
          batch_label: fileName,
        })),
      });
      toast({ title: 'Sub budget uploaded', description: `Budget uploaded for ${assignedMembers.find(s => s.id === selectedSubId)?.name || 'team member'}.` });
      resetUpload();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const toggleItem = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds(prev => prev.size === parsedItems.length ? new Set() : new Set(parsedItems.map(i => i.id)));
  };

  const updateMapping = (field: FieldKey, header: string) => {
    setColumnMapping(prev => ({ ...prev, [field]: header === '__none__' ? '' : header }));
  };

  return (
    <div className="card-elevated p-5 space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 font-display font-semibold text-lg hover:text-primary transition-colors"
        >
          {expanded ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
          <HardHat className="w-5 h-5 text-muted-foreground" />
          Subcontractor Budgets
          <span className="text-sm font-normal text-muted-foreground">({subBudgets.length} uploaded)</span>
        </button>
        <Button variant="outline" size="sm" onClick={() => { resetUpload(); setUploadOpen(true); }} className="text-xs font-display">
          <Upload className="w-3 h-3 mr-1" /> Upload Sub Budget
        </Button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            {subBudgets.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No subcontractor budgets uploaded yet.</p>
            ) : (
              <div className="space-y-3">
                {subBudgets.map((sb: any) => (
                  <SubBudgetRow
                    key={sb.id}
                    subBudget={sb}
                    isExpanded={viewingBudgetId === sb.id}
                    onToggle={() => setViewingBudgetId(prev => prev === sb.id ? null : sb.id)}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={(open) => { if (!open) resetUpload(); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              Upload Subcontractor Budget
              <span className="text-sm font-normal text-muted-foreground ml-2">— Step {wizardStep} of 3</span>
            </DialogTitle>
          </DialogHeader>

          {/* Step 1: Select sub + upload file */}
          {wizardStep === 1 && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-display font-semibold mb-1 block">Select Team Member</label>
                <Select value={selectedSubId} onValueChange={setSelectedSubId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a team member..." />
                  </SelectTrigger>
                  <SelectContent>
                    {assignedMembers.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        <div className="flex items-center gap-2">
                          <span>{m.crew_name || m.name}</span>
                          <span className="text-muted-foreground text-xs">— {m.email}</span>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground capitalize">{m.role}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {assignedMembers.length === 0 && (
                  <p className="text-xs text-destructive mt-1">No team members assigned to this project. Assign members first.</p>
                )}
              </div>

              <div>
                <label className="text-sm font-display font-semibold mb-1 block">Budget File (Excel/CSV)</label>
                <div className="relative">
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) { setFileName(file.name); parseFile(file); }
                      e.target.value = '';
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                  />
                  <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/50 transition-colors">
                    <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
                    <p className="text-sm text-muted-foreground">
                      {fileName ? <span className="text-foreground font-medium">{fileName}</span> : 'Drag & drop or tap to upload'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Column Mapping */}
          {wizardStep === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Map your spreadsheet columns to budget fields. We auto-detected some — adjust as needed.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {BUDGET_FIELDS.map(field => (
                  <div key={field.key} className="space-y-1">
                    <label className="text-xs font-display font-semibold flex items-center gap-1">
                      {field.label}
                      {field.required && <span className="text-destructive">*</span>}
                    </label>
                    <Select
                      value={columnMapping[field.key] || '__none__'}
                      onValueChange={(v) => updateMapping(field.key, v)}
                    >
                      <SelectTrigger className="h-9 text-sm truncate" title={columnMapping[field.key] || ''}>
                        <SelectValue placeholder="— Not mapped —" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60 overflow-y-auto">
                        <SelectItem value="__none__">— Not mapped —</SelectItem>
                        {spreadsheetHeaders.map(h => (
                          <SelectItem key={h} value={h} className="truncate max-w-[300px]" title={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              {/* Live preview */}
              {mappingPreview.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-display font-semibold text-muted-foreground">Preview (first {mappingPreview.length} rows)</p>
                  <div className="border border-border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-muted">
                          <tr>
                            <th className="p-2 text-left font-display">#</th>
                            <th className="p-2 text-left font-display">Item Name</th>
                            <th className="p-2 text-left font-display">Group</th>
                            <th className="p-2 text-left font-display">Description</th>
                            <th className="p-2 text-right font-display">Cost</th>
                          </tr>
                        </thead>
                        <tbody>
                          {mappingPreview.map((item, i) => (
                            <tr key={i} className="border-t border-border/50">
                              <td className="p-2 text-muted-foreground">{item.lineItemNo}</td>
                              <td className="p-2">{item.costItemName}</td>
                              <td className="p-2 text-muted-foreground">{item.costGroup}</td>
                              <td className="p-2 text-muted-foreground truncate max-w-[200px]">{item.description}</td>
                              <td className="p-2 text-right font-display font-semibold">${item.extendedCost.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Review & select items */}
          {wizardStep === 3 && parsedItems.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-display font-semibold">{selectedIds.size} of {parsedItems.length} items selected</p>
                <Button variant="ghost" size="sm" onClick={toggleAll} className="text-xs">
                  {selectedIds.size === parsedItems.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="overflow-x-auto max-h-56 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted">
                      <tr>
                        <th className="p-2 w-8"><Checkbox checked={selectedIds.size === parsedItems.length} onCheckedChange={toggleAll} /></th>
                        <th className="text-left p-2 text-xs font-display">#</th>
                        <th className="text-left p-2 text-xs font-display">Item</th>
                        <th className="text-left p-2 text-xs font-display">Group</th>
                        <th className="text-right p-2 text-xs font-display">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedItems.map(item => {
                        const sel = selectedIds.has(item.id);
                        return (
                          <tr key={item.id} className={`border-t border-border/50 cursor-pointer ${sel ? '' : 'opacity-40'}`} onClick={() => toggleItem(item.id)}>
                            <td className="p-2" onClick={e => e.stopPropagation()}><Checkbox checked={sel} onCheckedChange={() => toggleItem(item.id)} /></td>
                            <td className="p-2 text-muted-foreground">{item.lineItemNo}</td>
                            <td className="p-2">{item.costItemName}</td>
                            <td className="p-2 text-xs text-muted-foreground">{item.costGroup}</td>
                            <td className="p-2 text-right font-display font-semibold">${item.extendedCost.toLocaleString()}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="border-t border-border p-3 bg-muted/50 flex justify-between">
                  <span className="text-sm text-muted-foreground">Selected Total</span>
                  <span className="font-display font-bold">${parsedItems.filter(i => selectedIds.has(i.id)).reduce((s, i) => s + i.extendedCost, 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex justify-between gap-2">
            <div>
              {wizardStep > 1 && (
                <Button variant="ghost" size="sm" onClick={() => setWizardStep((wizardStep - 1) as 1 | 2)}>
                  <ArrowLeft className="w-3 h-3 mr-1" /> Back
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={resetUpload}>Cancel</Button>
              {wizardStep === 2 && (
                <Button onClick={handleMappingConfirm} disabled={!columnMapping.extendedCost && !columnMapping.costItemName}>
                  Continue <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              )}
              {wizardStep === 3 && (
                <Button
                  onClick={handleUpload}
                  disabled={!selectedSubId || selectedIds.size === 0 || saving}
                  className="gradient-primary text-primary-foreground"
                >
                  {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Saving...</> : 'Upload Budget'}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Sub-component to show individual sub budget with expandable line items
const SubBudgetRow: React.FC<{
  subBudget: any;
  isExpanded: boolean;
  onToggle: () => void;
}> = ({ subBudget, isExpanded, onToggle }) => {
  const { data: lineItems = [] } = useSubBudgetLineItems(isExpanded ? subBudget.id : undefined);
  const sub = subBudget.team_members;
  const total = lineItems.reduce((s: number, i: any) => s + Number(i.extended_cost), 0);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-display font-bold">
            {sub?.name?.[0] || '?'}
          </div>
          <div>
            <p className="font-display font-medium text-sm">{sub?.crew_name || sub?.name || 'Unknown'}</p>
            <p className="text-xs text-muted-foreground">{subBudget.file_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-display font-semibold text-sm">
            {isExpanded ? `$${total.toLocaleString()}` : ''}
          </span>
          {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && lineItems.length > 0 && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="border-t border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">#</TableHead>
                    <TableHead className="text-xs">Item</TableHead>
                    <TableHead className="text-xs">Group</TableHead>
                    <TableHead className="text-xs text-right">Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineItems.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-muted-foreground">{item.line_item_no}</TableCell>
                      <TableCell>
                        <p className="text-sm font-medium">{item.cost_item_name}</p>
                        {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{item.cost_group}</TableCell>
                      <TableCell className="text-right font-display font-semibold">${Number(item.extended_cost).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="border-t border-border p-3 bg-muted/50 flex justify-between">
                <span className="text-sm text-muted-foreground font-body">Total</span>
                <span className="font-display font-bold">${total.toLocaleString()}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SubcontractorBudgets;
