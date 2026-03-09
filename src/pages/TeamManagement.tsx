import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Plus, Pencil, Trash2, X, Check, Loader2, Shield, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTeamMembers, useCreateTeamMember, useUpdateTeamMember, useDeleteTeamMember, DbTeamMember } from '@/hooks/useProjects';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

type TeamRole = 'admin' | 'project-manager';

interface MemberForm {
  name: string;
  email: string;
  phone: string;
  role: TeamRole;
}

const emptyForm: MemberForm = { name: '', email: '', phone: '', role: 'project-manager' };

const TeamManagement = () => {
  const { data: allMembers = [], isLoading } = useTeamMembers();
  const createMember = useCreateTeamMember();
  const updateMember = useUpdateTeamMember();
  const deleteMember = useDeleteTeamMember();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MemberForm>(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | TeamRole>('all');

  const members = allMembers.filter(
    m => (m.role === 'admin' || m.role === 'project-manager') && (filter === 'all' || m.role === filter)
  );

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (m: DbTeamMember) => {
    setEditingId(m.id);
    setForm({ name: m.name, email: m.email, phone: m.phone, role: m.role as TeamRole });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      toast({ title: 'Name and email are required', variant: 'destructive' });
      return;
    }
    try {
      if (editingId) {
        await updateMember.mutateAsync({ id: editingId, name: form.name, email: form.email, phone: form.phone, role: form.role });
        toast({ title: 'Member updated' });
      } else {
        await createMember.mutateAsync({ name: form.name, email: form.email, phone: form.phone, role: form.role });
        toast({ title: 'Member added' });
      }
      setDialogOpen(false);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMember.mutateAsync(id);
      toast({ title: 'Member removed' });
      setDeleteConfirm(null);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const roleIcon = (role: string) => role === 'admin' ? <Shield className="w-4 h-4" /> : <Briefcase className="w-4 h-4" />;
  const roleLabel = (role: string) => role === 'admin' ? 'Admin' : 'Project Manager';
  const roleColor = (role: string) => role === 'admin' ? 'bg-primary/15 text-primary' : 'bg-accent/15 text-accent';

  return (
    <>
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Title + Add */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-primary" />
            <h2 className="font-display font-bold text-xl">Team Members</h2>
          </div>
          <Button onClick={openCreate} className="font-display">
            <Plus className="w-4 h-4 mr-1" /> Add Member
          </Button>
        </div>

        {/* Filter chips */}
        <div className="flex gap-2">
          {(['all', 'admin', 'project-manager'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-full text-sm font-body whitespace-nowrap transition-colors ${
                filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'
              }`}
            >
              {f === 'all' ? 'All' : f === 'admin' ? 'Admins' : 'Project Managers'}
            </button>
          ))}
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}

        {/* Members grid */}
        {!isLoading && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {members.map((m, i) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.03 }}
                  className="card-elevated p-5 relative group"
                >
                  {deleteConfirm === m.id ? (
                    <div className="space-y-3">
                      <p className="text-sm font-body">Remove <strong>{m.name}</strong>?</p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="destructive" onClick={() => handleDelete(m.id)} disabled={deleteMember.isPending}>
                          <Check className="w-3 h-3 mr-1" /> Yes
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setDeleteConfirm(null)}>
                          <X className="w-3 h-3 mr-1" /> No
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between mb-3">
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${roleColor(m.role)}`}>
                          {roleIcon(m.role)}
                          {roleLabel(m.role)}
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEdit(m)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setDeleteConfirm(m.id)} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <h3 className="font-display font-semibold text-base mb-1">{m.name}</h3>
                      <p className="text-sm text-muted-foreground font-body">{m.email}</p>
                      {m.phone && <p className="text-xs text-muted-foreground/70 font-body mt-0.5">{m.phone}</p>}
                    </>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {!isLoading && members.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground font-body">
                No team members found. Click "Add Member" to get started.
              </div>
            )}
          </div>
        )}
      </main>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">{editingId ? 'Edit Member' : 'Add Team Member'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium font-body mb-1.5 block">Name *</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="John Smith" />
            </div>
            <div>
              <label className="text-sm font-medium font-body mb-1.5 block">Email *</label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="john@company.com" />
            </div>
            <div>
              <label className="text-sm font-medium font-body mb-1.5 block">Phone</label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(555) 123-4567" />
            </div>
            <div>
              <label className="text-sm font-medium font-body mb-1.5 block">Role *</label>
              <Select value={form.role} onValueChange={(v: TeamRole) => setForm(f => ({ ...f, role: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="project-manager">Project Manager</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createMember.isPending || updateMember.isPending}>
              {(createMember.isPending || updateMember.isPending) && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {editingId ? 'Save Changes' : 'Add Member'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TeamManagement;
