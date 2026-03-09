import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import { Building2, LogOut, Plus, Upload, Users, FileSpreadsheet, ChevronRight, Trash2, Edit2, Eye, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link, useNavigate } from 'react-router-dom';
import type { Project, BudgetLineItem, User } from '@/types/budget';
import { mockProjects, mockBudgetLineItems } from '@/data/mockData';

// Mock subcontractors available to assign
const availableSubcontractors: User[] = [
  { id: '1', name: "Gloria's Crew", email: 'gloria@spacecowboy.com', phone: '512-555-0123', role: 'subcontractor', crewName: "Gloria's Crew" },
  { id: '3', name: "Beckett's Team", email: 'beckett@spacecowboy.com', phone: '512-555-0456', role: 'subcontractor', crewName: "Beckett's Team" },
  { id: '4', name: "Rio Finishers", email: 'rio@spacecowboy.com', phone: '512-555-0789', role: 'subcontractor', crewName: "Rio Finishers" },
  { id: '5', name: "Austin Interiors", email: 'austin@spacecowboy.com', phone: '512-555-0321', role: 'subcontractor', crewName: "Austin Interiors" },
];

type ProjectAssignment = {
  projectId: string;
  subcontractorIds: string[];
};

const ProjectPortal = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>(mockProjects);
  const [budgetItems, setBudgetItems] = useState<BudgetLineItem[]>(mockBudgetLineItems);
  const [assignments, setAssignments] = useState<ProjectAssignment[]>([
    { projectId: '1', subcontractorIds: ['1', '3'] },
    { projectId: '2', subcontractorIds: ['1'] },
  ]);

  const [view, setView] = useState<'list' | 'create' | 'detail'>('list');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [parsedItems, setParsedItems] = useState<BudgetLineItem[]>([]);
  const [showParsed, setShowParsed] = useState(false);

  // Create project form state
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newBudget, setNewBudget] = useState('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        if (rows.length === 0) {
          setParsedItems([]);
          setShowParsed(true);
          return;
        }

        // Map spreadsheet columns to BudgetLineItem fields
        // Priority: exact match on full header, then keyword fallback
        const headers = Object.keys(rows[0]);
        const headerLower = headers.map(h => h.toLowerCase().trim());

        // Ranked patterns: first match wins per field, checked in order
        // Each entry: [fieldKey, patterns[]] — patterns checked against full header
        const fieldPatterns: [string, RegExp[]][] = [
          ['lineItemNo', [/^line\s*item\s*#?$/i, /^line\s*#?$/i, /^#$/i, /^no\.?$/i, /^number$/i]],
          ['costGroup',  [/^cost\s*group$/i, /^group$/i, /^division$/i, /^category$/i, /^csi$/i]],
          ['costItemName', [/^cost\s*item\s*name$/i, /^item\s*name$/i, /^name$/i, /^trade$/i]],
          ['description', [/^description$/i, /^desc\.?$/i, /^scope$/i, /^work$/i, /^scope\s*of\s*work$/i]],
          ['quantity', [/^quantity$/i, /^qty\.?$/i]],
          ['unit', [/^unit$/i, /^uom$/i, /^unit\s*of\s*measure$/i]],
          ['extendedCost', [/^extended\s*cost$/i, /^ext\.?\s*cost$/i, /^amount$/i, /^total$/i, /^cost$/i, /^price$/i]],
          ['costType', [/^cost\s*type$/i, /^type$/i]],
          ['costCode', [/^cost\s*code$/i, /^code$/i]],
        ];

        const colMap: Record<string, string> = {};
        const usedHeaders = new Set<string>();

        for (const [field, patterns] of fieldPatterns) {
          for (const pattern of patterns) {
            const matchIdx = headers.findIndex((h, i) => !usedHeaders.has(h) && pattern.test(h.trim()));
            if (matchIdx !== -1) {
              colMap[field] = headers[matchIdx];
              usedHeaders.add(headers[matchIdx]);
              break;
            }
          }
        }

        const col = (field: string) => colMap[field] || '';

        const parsed: BudgetLineItem[] = rows.map((row, idx) => {
          const costRaw = String(row[col('extendedCost')] ?? '');
          const cost = parseFloat(costRaw.replace(/[^0-9.-]/g, '')) || 0;
          const lineNo = Number(row[col('lineItemNo')]);
          return {
            id: `parsed-${idx}`,
            projectId: 'pending',
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
        }).filter(item => item.costItemName || item.extendedCost > 0);

        setParsedItems(parsed);
        setShowParsed(true);
      } catch (err) {
        console.error('Failed to parse file:', err);
        setParsedItems([]);
        setShowParsed(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleCreateProject = () => {
    if (!newName || !newAddress) return;
    const budgetTotal = parsedItems.length > 0
      ? parsedItems.reduce((s, i) => s + i.extendedCost, 0)
      : Number(newBudget) || 0;

    const newProject: Project = {
      id: String(Date.now()),
      name: newName,
      address: newAddress,
      totalBudget: budgetTotal,
      amountInvoiced: 0,
      amountPaid: 0,
      status: 'active',
    };

    const newBudgetItems = parsedItems.map(item => ({ ...item, projectId: newProject.id }));
    setProjects([...projects, newProject]);
    setBudgetItems([...budgetItems, ...newBudgetItems]);
    setAssignments([...assignments, { projectId: newProject.id, subcontractorIds: [] }]);

    // Reset form
    setNewName('');
    setNewAddress('');
    setNewBudget('');
    setParsedItems([]);
    setShowParsed(false);
    setUploadedFileName('');
    setView('list');
  };

  const toggleSubAssignment = (projectId: string, subId: string) => {
    setAssignments(prev => prev.map(a => {
      if (a.projectId !== projectId) return a;
      const has = a.subcontractorIds.includes(subId);
      return {
        ...a,
        subcontractorIds: has
          ? a.subcontractorIds.filter(id => id !== subId)
          : [...a.subcontractorIds, subId],
      };
    }));
  };

  const getAssignedSubs = (projectId: string) => {
    const a = assignments.find(a => a.projectId === projectId);
    return a ? a.subcontractorIds : [];
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="gradient-dark px-4 py-4 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center">
              <Building2 className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display font-bold text-secondary-foreground text-sm">Budget Builder</h1>
              <p className="text-secondary-foreground/50 text-xs">Project Management</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/admin">
              <Button variant="ghost" size="sm" className="text-secondary-foreground/50 hover:text-secondary-foreground text-xs">
                Dashboard
              </Button>
            </Link>
            <Link to="/">
              <Button variant="ghost" size="sm" className="text-secondary-foreground/50 hover:text-secondary-foreground">
                <LogOut className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          {/* ===== PROJECT LIST ===== */}
          {view === 'list' && (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-display font-bold">Projects</h2>
                <Button onClick={() => setView('create')} className="gradient-primary text-primary-foreground font-display">
                  <Plus className="w-4 h-4 mr-2" /> New Project
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {projects.map(project => {
                  const assignedSubs = getAssignedSubs(project.id);
                  const projectBudgetItems = budgetItems.filter(b => b.projectId === project.id);
                  return (
                    <motion.div
                      key={project.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="card-elevated p-5 cursor-pointer hover:shadow-lg transition-shadow"
                      onClick={() => { setSelectedProject(project); setView('detail'); }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-display font-semibold text-lg">{project.name}</h3>
                          <p className="text-xs text-muted-foreground font-body">{project.address}</p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${project.status === 'active' ? 'status-badge-approved' : 'status-badge-pending'}`}>
                          {project.status}
                        </span>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground font-body">Budget</span>
                          <span className="font-display font-semibold">${project.totalBudget.toLocaleString()}</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${Math.min(100, (project.amountInvoiced / project.totalBudget) * 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>${project.amountInvoiced.toLocaleString()} invoiced</span>
                          <span>${(project.totalBudget - project.amountInvoiced).toLocaleString()} remaining</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <FileSpreadsheet className="w-3 h-3" />
                          <span>{projectBudgetItems.length} line items</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Users className="w-3 h-3" />
                          <span>{assignedSubs.length} subs</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ===== CREATE PROJECT ===== */}
          {view === 'create' && (
            <motion.div key="create" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6 max-w-2xl">
              <button onClick={() => { setView('list'); setParsedItems([]); setShowParsed(false); setUploadedFileName(''); }} className="text-muted-foreground text-sm hover:text-foreground transition-colors flex items-center gap-1">
                <ArrowLeft className="w-4 h-4" /> Back to Projects
              </button>

              <h2 className="text-2xl font-display font-bold">Create New Project</h2>

              <div className="card-elevated p-6 space-y-5">
                <div>
                  <Label htmlFor="project-name" className="font-display font-semibold">Project Name</Label>
                  <Input id="project-name" placeholder="e.g. Beckett Dr. Build-Out" className="mt-1" value={newName} onChange={e => setNewName(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="project-address" className="font-display font-semibold">Project Address</Label>
                  <Input id="project-address" placeholder="e.g. 7008 Beckett Dr., Austin TX" className="mt-1" value={newAddress} onChange={e => setNewAddress(e.target.value)} />
                </div>

                {/* Budget Upload */}
                <div className="space-y-3">
                  <Label className="font-display font-semibold">Upload Budget (Excel/CSV)</Label>
                  <p className="text-xs text-muted-foreground">Upload your project budget spreadsheet and we'll automatically parse it into line items.</p>
                  <div className="relative">
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer z-10"
                    />
                    <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors">
                      <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="font-body text-sm text-muted-foreground">
                        {uploadedFileName ? (
                          <span className="text-foreground font-medium">{uploadedFileName}</span>
                        ) : (
                          'Drag & drop or tap to upload'
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">.xlsx, .xls, or .csv</p>
                    </div>
                  </div>
                </div>

                {/* Parsed Budget Items Preview */}
                {showParsed && parsedItems.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-success" />
                      <p className="text-sm font-display font-semibold">{parsedItems.length} line items parsed</p>
                    </div>
                    <div className="border border-border rounded-lg overflow-hidden">
                      <div className="overflow-x-auto max-h-64 overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 bg-muted">
                            <tr>
                              <th className="text-left p-2 text-xs font-display">#</th>
                              <th className="text-left p-2 text-xs font-display">Item</th>
                              <th className="text-left p-2 text-xs font-display">Group</th>
                              <th className="text-right p-2 text-xs font-display">Cost</th>
                              <th className="text-left p-2 text-xs font-display">Type</th>
                            </tr>
                          </thead>
                          <tbody>
                            {parsedItems.map(item => (
                              <tr key={item.id} className="border-t border-border/50">
                                <td className="p-2 text-muted-foreground">{item.lineItemNo}</td>
                                <td className="p-2 font-body">{item.costItemName}</td>
                                <td className="p-2 text-muted-foreground text-xs">{item.costGroup}</td>
                                <td className="p-2 text-right font-display font-semibold">${item.extendedCost.toLocaleString()}</td>
                                <td className="p-2"><span className="px-1.5 py-0.5 rounded text-xs bg-muted text-muted-foreground">{item.costType}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="border-t border-border p-3 bg-muted/50 flex justify-between items-center">
                        <span className="text-sm text-muted-foreground font-body">Total Budget</span>
                        <span className="font-display font-bold text-lg">${parsedItems.reduce((s, i) => s + i.extendedCost, 0).toLocaleString()}</span>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Manual budget entry fallback */}
                {!showParsed && (
                  <div>
                    <Label htmlFor="manual-budget" className="font-display font-semibold">Or Enter Total Budget Manually</Label>
                    <Input id="manual-budget" type="number" placeholder="e.g. 45000" className="mt-1" value={newBudget} onChange={e => setNewBudget(e.target.value)} />
                  </div>
                )}

                <Button onClick={handleCreateProject} disabled={!newName || !newAddress} className="w-full gradient-primary text-primary-foreground py-5 text-lg font-display rounded-xl">
                  Create Project
                </Button>
              </div>
            </motion.div>
          )}

          {/* ===== PROJECT DETAIL ===== */}
          {view === 'detail' && selectedProject && (
            <motion.div key="detail" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
              <button onClick={() => { setView('list'); setSelectedProject(null); }} className="text-muted-foreground text-sm hover:text-foreground transition-colors flex items-center gap-1">
                <ArrowLeft className="w-4 h-4" /> Back to Projects
              </button>

              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-display font-bold">{selectedProject.name}</h2>
                  <p className="text-muted-foreground font-body">{selectedProject.address}</p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => navigate(`/invoice/new?project=${selectedProject.id}&admin=true`)} className="gradient-primary text-primary-foreground font-display">
                    <Plus className="w-4 h-4 mr-1" /> Submit Invoice for Sub
                  </Button>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: 'Total Budget', value: selectedProject.totalBudget },
                  { label: 'Invoiced', value: selectedProject.amountInvoiced },
                  { label: 'Paid', value: selectedProject.amountPaid },
                  { label: 'Remaining', value: selectedProject.totalBudget - selectedProject.amountInvoiced },
                ].map(stat => (
                  <div key={stat.label} className="card-elevated p-4">
                    <p className="text-xs text-muted-foreground font-body">{stat.label}</p>
                    <p className="text-xl font-display font-bold">${stat.value.toLocaleString()}</p>
                  </div>
                ))}
              </div>

              {/* Assigned Subcontractors */}
              <div className="card-elevated p-5 space-y-4">
                <h3 className="font-display font-semibold text-lg flex items-center gap-2">
                  <Users className="w-5 h-5 text-muted-foreground" />
                  Assigned Subcontractors
                </h3>
                <p className="text-xs text-muted-foreground font-body">
                  Toggle subcontractors to give them access to this project's portal and budget line items.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {availableSubcontractors.map(sub => {
                    const isAssigned = getAssignedSubs(selectedProject.id).includes(sub.id);
                    return (
                      <button
                        key={sub.id}
                        onClick={() => toggleSubAssignment(selectedProject.id, sub.id)}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                          isAssigned ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/30'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-display font-bold ${
                          isAssigned ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                        }`}>
                          {sub.crewName?.[0] || sub.name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-display font-medium text-sm truncate">{sub.crewName || sub.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{sub.email}</p>
                        </div>
                        {isAssigned && <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Budget Line Items */}
              <div className="card-elevated p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-semibold text-lg flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-muted-foreground" />
                    Budget Line Items
                  </h3>
                  <Button variant="outline" size="sm" className="font-display text-xs">
                    <Upload className="w-3 h-3 mr-1" /> Re-upload Budget
                  </Button>
                </div>
                {(() => {
                  const items = budgetItems.filter(b => b.projectId === selectedProject.id);
                  if (items.length === 0) {
                    return (
                      <div className="text-center py-8">
                        <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-muted-foreground font-body">No budget items yet. Upload a budget spreadsheet to get started.</p>
                      </div>
                    );
                  }
                  return (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left p-3 font-display font-semibold text-muted-foreground text-xs">#</th>
                            <th className="text-left p-3 font-display font-semibold text-muted-foreground text-xs">Item</th>
                            <th className="text-left p-3 font-display font-semibold text-muted-foreground text-xs">Description</th>
                            <th className="text-right p-3 font-display font-semibold text-muted-foreground text-xs">Qty</th>
                            <th className="text-left p-3 font-display font-semibold text-muted-foreground text-xs">Unit</th>
                            <th className="text-right p-3 font-display font-semibold text-muted-foreground text-xs">Cost</th>
                            <th className="text-left p-3 font-display font-semibold text-muted-foreground text-xs">Type</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map(item => (
                            <tr key={item.id} className="border-b border-border/50 hover:bg-muted/30">
                              <td className="p-3">{item.lineItemNo}</td>
                              <td className="p-3 font-body font-medium">{item.costItemName}</td>
                              <td className="p-3 text-muted-foreground text-xs max-w-[200px] truncate">{item.description}</td>
                              <td className="p-3 text-right">{item.quantity.toLocaleString()}</td>
                              <td className="p-3 text-muted-foreground text-xs">{item.unit}</td>
                              <td className="p-3 text-right font-display font-semibold">${item.extendedCost.toLocaleString()}</td>
                              <td className="p-3"><span className="px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground">{item.costType}</span></td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-border">
                            <td colSpan={5} className="p-3 text-right font-display font-semibold">Total</td>
                            <td className="p-3 text-right font-display font-bold text-lg">${items.reduce((s, i) => s + i.extendedCost, 0).toLocaleString()}</td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default ProjectPortal;
