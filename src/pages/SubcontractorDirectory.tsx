import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Phone, Mail, Globe, MapPin, X, Loader2, Trash2, HardHat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const SUBCONTRACTOR_TYPES = [
  'General Contractor', 'Electrician', 'Plumber', 'HVAC', 'Roofer',
  'Painter', 'Flooring', 'Concrete', 'Framing', 'Drywall',
  'Landscaping', 'Excavation', 'Masonry', 'Steel/Iron Work',
  'Insulation', 'Fire Protection', 'Demolition', 'Fencing', 'Other',
];

const SPECIALTIES = [
  'Residential', 'Commercial', 'Industrial', 'Government',
  'New Construction', 'Renovation', 'Tenant Improvement',
  'Historic Restoration', 'Green/LEED', 'Emergency/24hr',
  'High-Rise', 'Multi-Family', 'Single Family', 'Mixed-Use',
  'Healthcare', 'Education', 'Hospitality', 'Retail',
];

type DirectoryEntry = {
  id: string;
  company_name: string;
  contact_name: string;
  subcontractor_type: string;
  location: string;
  specialties: string[];
  phone: string;
  email: string;
  website: string;
  notes: string;
  created_by: string | null;
  created_at: string;
};

const emptyForm = {
  company_name: '',
  contact_name: '',
  subcontractor_type: '',
  location: '',
  specialties: [] as string[],
  phone: '',
  email: '',
  website: '',
  notes: '',
};

export default function SubcontractorDirectory() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['subcontractor-directory'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subcontractor_directory')
        .select('*')
        .order('company_name');
      if (error) throw error;
      return data as DirectoryEntry[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async (entry: typeof emptyForm) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('subcontractor_directory')
        .insert({ ...entry, created_by: user?.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subcontractor-directory'] });
      setDialogOpen(false);
      setForm(emptyForm);
      toast.success('Subcontractor added to directory');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('subcontractor_directory').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subcontractor-directory'] });
      toast.success('Entry removed');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleSpecialty = (s: string) => {
    setForm(prev => ({
      ...prev,
      specialties: prev.specialties.includes(s)
        ? prev.specialties.filter(x => x !== s)
        : [...prev.specialties, s],
    }));
  };

  const filtered = entries.filter(e => {
    const matchesSearch =
      !search ||
      e.company_name.toLowerCase().includes(search.toLowerCase()) ||
      e.contact_name.toLowerCase().includes(search.toLowerCase()) ||
      e.location.toLowerCase().includes(search.toLowerCase()) ||
      e.specialties.some(s => s.toLowerCase().includes(search.toLowerCase()));
    const matchesType = typeFilter === 'all' || e.subcontractor_type === typeFilter;
    return matchesSearch && matchesType;
  });

  const usedTypes = [...new Set(entries.map(e => e.subcontractor_type).filter(Boolean))];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-xl flex items-center gap-2">
            <HardHat className="w-5 h-5 text-muted-foreground" />
            Subcontractor Directory
          </h2>
          <p className="text-sm text-muted-foreground">Shared list of subcontractors for the entire team</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-primary-foreground gap-1.5">
              <Plus className="w-4 h-4" /> Add Subcontractor
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">Add Subcontractor</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={e => { e.preventDefault(); addMutation.mutate(form); }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Company Name *</Label>
                  <Input required value={form.company_name} onChange={e => setForm(p => ({ ...p, company_name: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Contact Name</Label>
                  <Input value={form.contact_name} onChange={e => setForm(p => ({ ...p, contact_name: e.target.value }))} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Type *</Label>
                  <Select value={form.subcontractor_type} onValueChange={v => setForm(p => ({ ...p, subcontractor_type: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      {SUBCONTRACTOR_TYPES.map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Location</Label>
                  <Input placeholder="City, State" value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Specialties</Label>
                <div className="flex flex-wrap gap-1.5 p-3 border border-border rounded-lg bg-muted/20 max-h-32 overflow-y-auto">
                  {SPECIALTIES.map(s => (
                    <Badge
                      key={s}
                      variant={form.specialties.includes(s) ? 'default' : 'outline'}
                      className="cursor-pointer text-xs transition-colors"
                      onClick={() => toggleSpecialty(s)}
                    >
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input type="tel" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Website</Label>
                  <Input type="url" placeholder="https://" value={form.website} onChange={e => setForm(p => ({ ...p, website: e.target.value }))} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
              </div>

              <Button type="submit" className="w-full gradient-primary text-primary-foreground" disabled={addMutation.isPending || !form.company_name || !form.subcontractor_type}>
                {addMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                Add to Directory
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name, location, specialty..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setSearch('')}>
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {usedTypes.map(t => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <HardHat className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-display font-semibold">{search || typeFilter !== 'all' ? 'No matching subcontractors' : 'No subcontractors yet'}</p>
          <p className="text-sm mt-1">Add your first subcontractor to get started.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((entry, i) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="card-elevated p-4 space-y-3 group"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-display font-semibold">{entry.company_name}</h3>
                  {entry.contact_name && (
                    <p className="text-sm text-muted-foreground">{entry.contact_name}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Badge variant="secondary" className="text-xs">{entry.subcontractor_type}</Badge>
                  <button
                    onClick={() => { if (confirm('Remove this entry?')) deleteMutation.mutate(entry.id); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/10 rounded"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </button>
                </div>
              </div>

              {entry.location && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                  {entry.location}
                </div>
              )}

              {entry.specialties.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {entry.specialties.map(s => (
                    <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-3 text-sm">
                {entry.phone && (
                  <a href={`tel:${entry.phone}`} className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
                    <Phone className="w-3.5 h-3.5" /> {entry.phone}
                  </a>
                )}
                {entry.email && (
                  <a href={`mailto:${entry.email}`} className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
                    <Mail className="w-3.5 h-3.5" /> {entry.email}
                  </a>
                )}
                {entry.website && (
                  <a href={entry.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
                    <Globe className="w-3.5 h-3.5" /> Website
                  </a>
                )}
              </div>

              {entry.notes && (
                <p className="text-xs text-muted-foreground border-t border-border pt-2">{entry.notes}</p>
              )}
            </motion.div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">
        {filtered.length} of {entries.length} subcontractor{entries.length !== 1 ? 's' : ''}
      </p>
    </div>
  );
}
