import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import { Upload, ChevronRight, ChevronDown, HardHat, FileSpreadsheet, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useSubBudgets, useSubBudgetLineItems, useCreateSubBudget } from '@/hooks/useProjects';
import type { DbTeamMember } from '@/hooks/useProjects';

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
  assignedSubs: DbTeamMember[];
  currentUserId: string;
}

const SubcontractorBudgets: React.FC<SubcontractorBudgetsProps> = ({
  projectId,
  assignedSubs,
  currentUserId,
}) => {
  const { toast } = useToast();
  const { data: subBudgets = [] } = useSubBudgets(projectId);
  const createSubBudget = useCreateSubBudget();

  const [expanded, setExpanded] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedSubId, setSelectedSubId] = useState('');
  const [parsedItems, setParsedItems] = useState<ParsedLineItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [fileName, setFileName] = useState('');
  const [saving, setSaving] = useState(false);
  const [viewingBudgetId, setViewingBudgetId] = useState<string | null>(null);

  const parseFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        if (rows.length === 0) { setParsedItems([]); return; }

        const headers = Object.keys(rows[0]);
        const fieldPatterns: [string, RegExp[]][] = [
          ['lineItemNo', [/^line\s*item\s*#?$/i, /^line\s*#?$/i, /^#$/i, /^no\.?$/i, /^number$/i]],
          ['costGroup',  [/^cost\s*group$/i, /^group$/i, /^division$/i, /^category$/i]],
          ['costItemName', [/^cost\s*item\s*name$/i, /^item\s*name$/i, /^name$/i, /^trade$/i]],
          ['description', [/^description$/i, /^desc\.?$/i, /^scope$/i]],
          ['quantity', [/^quantity$/i, /^qty\.?$/i]],
          ['unit', [/^unit$/i, /^uom$/i]],
          ['extendedCost', [/^extended\s*cost$/i, /^ext\.?\s*cost$/i, /^amount$/i, /^total$/i, /^cost$/i, /^price$/i]],
          ['costType', [/^cost\s*type$/i, /^type$/i]],
          ['costCode', [/^cost\s*code$/i, /^code$/i]],
        ];
        const colMap: Record<string, string> = {};
        const usedHeaders = new Set<string>();
        for (const [field, patterns] of fieldPatterns) {
          for (const pattern of patterns) {
            const idx = headers.findIndex(h => !usedHeaders.has(h) && pattern.test(h.trim()));
            if (idx !== -1) { colMap[field] = headers[idx]; usedHeaders.add(headers[idx]); break; }
          }
        }
        const col = (f: string) => colMap[f] || '';
        const parsed = rows.map((row, idx) => {
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
        setParsedItems(parsed);
        setSelectedIds(new Set(parsed.map(i => i.id)));
      } catch {
        setParsedItems([]);
      }
    };
    reader.readAsArrayBuffer(file);
  };

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
      toast({ title: 'Sub budget uploaded', description: `Budget uploaded for ${assignedSubs.find(s => s.id === selectedSubId)?.name || 'subcontractor'}.` });
      setUploadOpen(false);
      setParsedItems([]);
      setFileName('');
      setSelectedSubId('');
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
        <Button variant="outline" size="sm" onClick={() => setUploadOpen(true)} className="text-xs font-display">
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
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Upload Subcontractor Budget</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-display font-semibold mb-1 block">Select Subcontractor</label>
              <Select value={selectedSubId} onValueChange={setSelectedSubId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a subcontractor..." />
                </SelectTrigger>
                <SelectContent>
                  {assignedSubs.map(sub => (
                    <SelectItem key={sub.id} value={sub.id}>
                      {sub.crew_name || sub.name} — {sub.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

            {parsedItems.length > 0 && (
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
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button>
            <Button
              onClick={handleUpload}
              disabled={!selectedSubId || selectedIds.size === 0 || saving}
              className="gradient-primary text-primary-foreground"
            >
              {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Saving...</> : 'Upload Budget'}
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
