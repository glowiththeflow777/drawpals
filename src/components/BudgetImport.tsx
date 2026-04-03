import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import type { DbTeamMember } from '@/hooks/useProjects';

interface ParsedRow {
  costGroup: string;
  costItemName: string;
  description: string;
  quantity: number;
  unit: string;
  extendedCost: number;
  extendedPrice: number;
  costType: string;
  costCode: string;
}

interface BudgetImportProps {
  projectId: string;
  assignedMembers: DbTeamMember[];
  currentUserId: string;
  onComplete?: () => void;
}

function parseCurrency(val: any): number {
  if (val == null || val === '') return 0;
  return parseFloat(String(val).replace(/[^0-9.-]/g, '')) || 0;
}

function parseJobTreadCSV(rows: Record<string, any>[]): ParsedRow[] {
  return rows
    .filter(row => {
      // Only keep actual line items (rows with a Cost Item Name and a Cost Type)
      const name = String(row['Cost Item Name'] || '').trim();
      const costType = String(row['Cost Type'] || '').trim();
      return name !== '' && costType !== '';
    })
    .map(row => ({
      costGroup: String(row['Cost Group'] || ''),
      costItemName: String(row['Cost Item Name'] || ''),
      description: String(row['Description'] || ''),
      quantity: parseCurrency(row['Quantity']),
      unit: String(row['Unit'] || 'Each'),
      extendedCost: parseCurrency(row['Extended Cost']),
      extendedPrice: parseCurrency(row['Extended Price']),
      costType: String(row['Cost Type'] || 'Labor'),
      costCode: '',
    }));
}

const BudgetImport: React.FC<BudgetImportProps> = ({
  projectId,
  assignedMembers,
  currentUserId,
  onComplete,
}) => {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [selectedSubId, setSelectedSubId] = useState('');
  const [saving, setSaving] = useState(false);

  const subs = assignedMembers.filter(m => m.role === 'subcontractor');

  const summary = useMemo(() => {
    if (parsedRows.length === 0) return null;
    const byType: Record<string, { count: number; costTotal: number; priceTotal: number }> = {};
    parsedRows.forEach(r => {
      if (!byType[r.costType]) byType[r.costType] = { count: 0, costTotal: 0, priceTotal: 0 };
      byType[r.costType].count++;
      byType[r.costType].costTotal += r.extendedCost;
      byType[r.costType].priceTotal += r.extendedPrice;
    });
    const totalCost = parsedRows.reduce((s, r) => s + r.extendedCost, 0);
    const totalPrice = parsedRows.reduce((s, r) => s + r.extendedPrice, 0);
    const subRows = parsedRows.filter(r => r.costType === 'Labor' || r.costType === 'Subcontractor');
    const subCost = subRows.reduce((s, r) => s + r.extendedCost, 0);
    return { byType, totalCost, totalPrice, subRowCount: subRows.length, subCost };
  }, [parsedRows]);

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
        const parsed = parseJobTreadCSV(rows);
        setParsedRows(parsed);
        if (parsed.length === 0) {
          toast({ title: 'No line items found', description: 'The file did not contain any valid line items with a Cost Item Name and Cost Type.', variant: 'destructive' });
        }
      } catch {
        toast({ title: 'Parse error', description: 'Could not read the file.', variant: 'destructive' });
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleImport = async () => {
    if (parsedRows.length === 0) return;
    const effectiveSubId = selectedSubId === '__none__' ? '' : selectedSubId;
    setSaving(true);
    try {
      const batchLabel = fileName || `Budget ${new Date().toLocaleDateString()}`;

      // 1. Insert master budget (ALL items, using Extended Price)
      const masterItems = parsedRows.map((r, idx) => ({
        project_id: projectId,
        line_item_no: idx + 1,
        cost_group: r.costGroup,
        cost_item_name: r.costItemName,
        description: r.description,
        quantity: r.quantity,
        unit: r.unit,
        extended_cost: r.extendedPrice, // Master uses client-facing price
        cost_type: r.costType,
        cost_code: r.costCode,
        batch_label: batchLabel,
      }));
      const { error: masterErr } = await supabase.from('budget_line_items').insert(masterItems);
      if (masterErr) throw masterErr;

      // 2. Insert sub budget (Labor + Subcontractor items only, using Extended Cost)
      if (effectiveSubId) {
        const subRows = parsedRows.filter(r => r.costType === 'Labor' || r.costType === 'Subcontractor');
        if (subRows.length > 0) {
          // Upsert the sub_budget record
          const { data: subBudget, error: sbErr } = await supabase
            .from('sub_budgets')
            .upsert(
              { project_id: projectId, team_member_id: effectiveSubId, uploaded_by: currentUserId, file_name: batchLabel },
              { onConflict: 'project_id,team_member_id' }
            )
            .select()
            .single();
          if (sbErr) throw sbErr;

          const budgetId = (subBudget as any).id;
          // Clear existing line items then insert new
          await supabase.from('sub_budget_line_items').delete().eq('sub_budget_id', budgetId);
          const subItems = subRows.map((r, idx) => ({
            sub_budget_id: budgetId,
            line_item_no: idx + 1,
            cost_group: r.costGroup,
            cost_item_name: r.costItemName,
            description: r.description,
            quantity: r.quantity,
            unit: r.unit,
            extended_cost: r.extendedCost, // Sub uses internal cost
            cost_type: r.costType,
            cost_code: r.costCode,
            batch_label: batchLabel,
          }));
          const { error: subLineErr } = await supabase.from('sub_budget_line_items').insert(subItems);
          if (subLineErr) throw subLineErr;
        }
      }

      // 3. Update project total budget
      const masterTotal = masterItems.reduce((s, i) => s + i.extended_cost, 0);
      const { data: currentProject } = await supabase.from('projects').select('total_budget').eq('id', projectId).single();
      const currentTotal = Number((currentProject as any)?.total_budget || 0);
      await supabase.from('projects').update({ total_budget: currentTotal + masterTotal }).eq('id', projectId);

      // Invalidate queries
      qc.invalidateQueries({ queryKey: ['budget_line_items'] });
      qc.invalidateQueries({ queryKey: ['sub_budgets', projectId] });
      qc.invalidateQueries({ queryKey: ['sub_budget_line_items'] });
      qc.invalidateQueries({ queryKey: ['projects'] });

      const subName = selectedSubId && selectedSubId !== '__none__' ? (subs.find(s => s.id === selectedSubId)?.crew_name || subs.find(s => s.id === selectedSubId)?.name || '') : '';
      toast({
        title: 'Budget imported!',
        description: `${masterItems.length} master items imported${selectedSubId && selectedSubId !== '__none__' ? ` and ${parsedRows.filter(r => r.costType === 'Labor' || r.costType === 'Subcontractor').length} labor items assigned to ${subName}` : ''}.`,
      });

      // Reset and close
      setParsedRows([]);
      setFileName('');
      setSelectedSubId('');
      setOpen(false);
      onComplete?.();
    } catch (err: any) {
      toast({ title: 'Import failed', description: err.message || 'An error occurred.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setParsedRows([]);
    setFileName('');
    setSelectedSubId('');
    setOpen(false);
  };

  return (
    <>
      <Button variant="outline" size="sm" className="font-display text-xs" onClick={() => setOpen(true)}>
        <Upload className="w-3 h-3 mr-1" /> Import Budget
      </Button>

      <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); else setOpen(true); }}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              Import JobTread Budget
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* File upload */}
            <div>
              <label className="text-sm font-display font-semibold mb-1 block">Budget File (CSV / Excel)</label>
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
                </div>
              </div>
            </div>

            {/* Summary */}
            {summary && (
              <div className="space-y-3">
                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="bg-muted/30 px-4 py-2">
                    <span className="font-display font-semibold text-sm">Import Summary</span>
                  </div>
                  <div className="p-4 space-y-2">
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-2xl font-display font-bold">{parsedRows.length}</p>
                        <p className="text-xs text-muted-foreground">Total Items</p>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-2xl font-display font-bold">${summary.totalPrice.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Master Budget</p>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-2xl font-display font-bold">${summary.subCost.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Sub Budget (Cost)</p>
                      </div>
                    </div>

                    <div className="border border-border rounded-lg overflow-hidden mt-3">
                      <table className="w-full text-sm">
                        <thead className="bg-muted">
                          <tr>
                            <th className="text-left p-2 font-display text-xs">Cost Type</th>
                            <th className="text-right p-2 font-display text-xs">Items</th>
                            <th className="text-right p-2 font-display text-xs">Your Cost</th>
                            <th className="text-right p-2 font-display text-xs">Client Price</th>
                            <th className="text-center p-2 font-display text-xs">Sub Budget?</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(summary.byType).map(([type, info]) => (
                            <tr key={type} className="border-t border-border/50">
                              <td className="p-2 font-medium">{type}</td>
                              <td className="p-2 text-right">{info.count}</td>
                              <td className="p-2 text-right font-display">${info.costTotal.toLocaleString()}</td>
                              <td className="p-2 text-right font-display">${info.priceTotal.toLocaleString()}</td>
                              <td className="p-2 text-center">
                                {type === 'Labor' || type === 'Subcontractor' ? (
                                  <CheckCircle2 className="w-4 h-4 text-primary mx-auto" />
                                ) : (
                                  <span className="text-muted-foreground text-xs">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-border font-semibold">
                            <td className="p-2">Total</td>
                            <td className="p-2 text-right">{parsedRows.length}</td>
                            <td className="p-2 text-right font-display">${summary.totalCost.toLocaleString()}</td>
                            <td className="p-2 text-right font-display">${summary.totalPrice.toLocaleString()}</td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Subcontractor assignment */}
                <div className="border border-border rounded-lg p-4 space-y-2">
                  <label className="text-sm font-display font-semibold block">
                    Assign Labor & Subcontractor items to:
                  </label>
                  <p className="text-xs text-muted-foreground">
                    {summary.subRowCount} items (${summary.subCost.toLocaleString()}) will be added to their sub budget at your cost.
                    Materials ({parsedRows.filter(r => r.costType === 'Materials').length} items) stay on the master budget only.
                  </p>
                  <Select value={selectedSubId} onValueChange={setSelectedSubId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a subcontractor (optional)..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Skip sub budget —</SelectItem>
                      {subs.map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.crew_name || s.name} — {s.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {subs.length === 0 && (
                    <p className="text-xs text-amber-600">No subcontractors assigned to this project. You can still import the master budget.</p>
                  )}
                </div>
              </div>
            )}

            {parsedRows.length === 0 && fileName && (
              <div className="text-center py-4">
                <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No valid line items found. Make sure the file has "Cost Item Name" and "Cost Type" columns.</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={reset}>Cancel</Button>
            <Button
              onClick={handleImport}
              disabled={saving || parsedRows.length === 0}
              className="gradient-primary text-primary-foreground"
            >
              {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
              Import {parsedRows.length} Items
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default BudgetImport;
