import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import { Upload, ChevronRight, ChevronDown, HardHat, Loader2, Trash2, CheckCircle2, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useSubBudgets, useSubBudgetLineItems, useCreateSubBudget, useDeleteSubBudget } from '@/hooks/useProjects';
import type { DbTeamMember } from '@/hooks/useProjects';

interface ParsedSubItem {
  costGroup: string;
  costItemName: string;
  description: string;
  quantity: number;
  unit: string;
  extendedCost: number;
  costType: string;
  costCode: string;
}

function parseCurrency(val: any): number {
  if (val == null || val === '') return 0;
  return parseFloat(String(val).replace(/[^0-9.-]/g, '')) || 0;
}

/** Parse a JobTread CSV and return ONLY Labor & Subcontractor items at Extended Cost */
function parseSubBudgetFromJobTread(rows: Record<string, any>[]): { subItems: ParsedSubItem[]; totalItems: number; skippedCount: number } {
  const allItems = rows.filter(row => {
    const name = String(row['Cost Item Name'] || '').trim();
    const costType = String(row['Cost Type'] || '').trim();
    return name !== '' && costType !== '';
  });

  const subItems: ParsedSubItem[] = allItems
    .filter(row => {
      const ct = String(row['Cost Type'] || '').trim();
      return ct === 'Labor' || ct === 'Subcontractor';
    })
    .map(row => ({
      costGroup: String(row['Cost Group'] || ''),
      costItemName: String(row['Cost Item Name'] || ''),
      description: String(row['Description'] || ''),
      quantity: parseCurrency(row['Quantity']),
      unit: String(row['Unit'] || 'Each'),
      extendedCost: parseCurrency(row['Extended Cost']),
      costType: String(row['Cost Type'] || 'Labor'),
      costCode: '',
    }));

  return { subItems, totalItems: allItems.length, skippedCount: allItems.length - subItems.length };
}

interface SubcontractorBudgetsProps {
  projectId: string;
  assignedMembers: DbTeamMember[];
  currentUserId: string;
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

  // Parsed data
  const [parsedSubItems, setParsedSubItems] = useState<ParsedSubItem[]>([]);
  const [parseStats, setParseStats] = useState<{ totalItems: number; skippedCount: number } | null>(null);

  const subs = assignedMembers.filter(m => m.role === 'subcontractor');

  const subTotal = useMemo(() => parsedSubItems.reduce((s, i) => s + i.extendedCost, 0), [parsedSubItems]);

  const resetUpload = () => {
    setUploadOpen(false);
    setParsedSubItems([]);
    setParseStats(null);
    setFileName('');
    setSelectedSubId('');
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const wb = XLSX.read(data, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        const { subItems, totalItems, skippedCount } = parseSubBudgetFromJobTread(rows);
        setParsedSubItems(subItems);
        setParseStats({ totalItems, skippedCount });
        if (subItems.length === 0) {
          toast({ title: 'No labor items found', description: 'The file did not contain any Labor or Subcontractor cost type items.', variant: 'destructive' });
        }
      } catch {
        toast({ title: 'Parse error', description: 'Could not read the file.', variant: 'destructive' });
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleUpload = async () => {
    if (!selectedSubId || parsedSubItems.length === 0) return;
    setSaving(true);
    try {
      await createSubBudget.mutateAsync({
        project_id: projectId,
        team_member_id: selectedSubId,
        uploaded_by: currentUserId,
        file_name: fileName,
        line_items: parsedSubItems.map((i, idx) => ({
          line_item_no: idx + 1,
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
      const subName = subs.find(s => s.id === selectedSubId)?.crew_name || subs.find(s => s.id === selectedSubId)?.name || 'team member';
      toast({ title: 'Sub budget uploaded', description: `${parsedSubItems.length} labor items assigned to ${subName}.` });
      resetUpload();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
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
                    projectId={projectId}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload Dialog — streamlined single step */}
      <Dialog open={uploadOpen} onOpenChange={(open) => { if (!open) resetUpload(); }}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              Upload Sub Budget
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Select subcontractor */}
            <div>
              <label className="text-sm font-display font-semibold mb-1 block">Assign to Subcontractor</label>
              <Select value={selectedSubId} onValueChange={setSelectedSubId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a subcontractor..." />
                </SelectTrigger>
                <SelectContent>
                  {subs.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.crew_name || s.name} — {s.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {subs.length === 0 && (
                <p className="text-xs text-destructive mt-1">No subcontractors assigned to this project. Assign members first.</p>
              )}
            </div>

            {/* File upload */}
            <div>
              <label className="text-sm font-display font-semibold mb-1 block">Budget File (JobTread CSV / Excel)</label>
              <div className="relative">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFile}
                  className="absolute inset-0 opacity-0 cursor-pointer z-10"
                />
                <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/50 transition-colors">
                  <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
                  <p className="text-sm text-muted-foreground">
                    {fileName ? <span className="text-foreground font-medium">{fileName}</span> : 'Drag & drop or tap to upload'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Only Labor & Subcontractor cost types will be imported at Extended Cost</p>
                </div>
              </div>
            </div>

            {/* Auto-filtered summary */}
            {parseStats && parsedSubItems.length > 0 && (
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="bg-muted/30 px-4 py-2">
                  <span className="font-display font-semibold text-sm">Import Preview</span>
                </div>
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-2xl font-display font-bold">{parseStats.totalItems}</p>
                      <p className="text-xs text-muted-foreground">Total in File</p>
                    </div>
                    <div className="p-3 bg-primary/10 rounded-lg">
                      <p className="text-2xl font-display font-bold text-primary">{parsedSubItems.length}</p>
                      <p className="text-xs text-muted-foreground">Labor Items</p>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-2xl font-display font-bold">${subTotal.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Sub Cost Total</p>
                    </div>
                  </div>

                  {parseStats.skippedCount > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {parseStats.skippedCount} non-labor items (Materials, etc.) were automatically excluded.
                    </p>
                  )}

                  {/* Line items preview */}
                  <div className="border border-border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto max-h-56 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-muted">
                          <tr>
                            <th className="text-left p-2 text-xs font-display">#</th>
                            <th className="text-left p-2 text-xs font-display">Item</th>
                            <th className="text-left p-2 text-xs font-display">Group</th>
                            <th className="text-left p-2 text-xs font-display">Type</th>
                            <th className="text-right p-2 text-xs font-display">Cost</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parsedSubItems.map((item, idx) => (
                            <tr key={idx} className="border-t border-border/50">
                              <td className="p-2 text-muted-foreground">{idx + 1}</td>
                              <td className="p-2">{item.costItemName}</td>
                              <td className="p-2 text-xs text-muted-foreground truncate max-w-[150px]">{item.costGroup}</td>
                              <td className="p-2 text-xs text-muted-foreground">{item.costType}</td>
                              <td className="p-2 text-right font-display font-semibold">${item.extendedCost.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="border-t border-border p-3 bg-muted/50 flex justify-between">
                      <span className="text-sm text-muted-foreground">Total</span>
                      <span className="font-display font-bold">${subTotal.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetUpload}>Cancel</Button>
            <Button
              onClick={handleUpload}
              disabled={saving || !selectedSubId || parsedSubItems.length === 0}
              className="gradient-primary text-primary-foreground"
            >
              {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
              Upload {parsedSubItems.length} Items
            </Button>
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
  projectId: string;
}> = ({ subBudget, isExpanded, onToggle, projectId }) => {
  const { data: lineItems = [] } = useSubBudgetLineItems(isExpanded ? subBudget.id : undefined);
  const { toast } = useToast();
  const deleteSubBudget = useDeleteSubBudget();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const sub = subBudget.team_members;
  const total = lineItems.reduce((s: number, i: any) => s + Number(i.extended_cost), 0);

  const handleDelete = async () => {
    try {
      await deleteSubBudget.mutateAsync({ subBudgetId: subBudget.id, projectId });
      toast({ title: 'Budget deleted', description: `Budget for ${sub?.name || 'team member'} has been removed.` });
      setConfirmDelete(false);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors">
        <button onClick={onToggle} className="flex items-center gap-3 flex-1 text-left">
          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-display font-bold">
            {sub?.name?.[0] || '?'}
          </div>
          <div>
            <p className="font-display font-medium text-sm">{sub?.crew_name || sub?.name || 'Unknown'}</p>
            <p className="text-xs text-muted-foreground">{subBudget.file_name}</p>
          </div>
        </button>
        <div className="flex items-center gap-2">
          <span className="font-display font-semibold text-sm">
            {isExpanded ? `$${total.toLocaleString()}` : ''}
          </span>
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <Button variant="destructive" size="sm" className="text-xs h-7" onClick={handleDelete} disabled={deleteSubBudget.isPending}>
                {deleteSubBudget.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Confirm'}
              </Button>
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            </div>
          ) : (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
          <button onClick={onToggle}>
            {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          </button>
        </div>
      </div>

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
