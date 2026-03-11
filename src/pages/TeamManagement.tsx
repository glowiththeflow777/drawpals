import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Plus, Pencil, Trash2, X, Check, Loader2, Shield, Briefcase, HardHat, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useTeamMembers, useCreateTeamMember, useUpdateTeamMember, useDeleteTeamMember, DbTeamMember } from '@/hooks/useProjects';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

type TeamRole = 'admin' | 'project-manager' | 'subcontractor';

interface MemberForm {
  name: string;
  email: string;
  phone: string;
  role: TeamRole; // Primary role for team_members table
  roles: TeamRole[]; // All roles for user_roles table
  crew_name: string;
}

const emptyForm: MemberForm = { name: '', email: '', phone: '', role: 'subcontractor', roles: ['subcontractor'], crew_name: '' };

const TeamManagement = () => {
  const { data: allMembers = [], isLoading } = useTeamMembers();
  const createMember = useCreateTeamMember();
  const updateMember = useUpdateTeamMember();
  const deleteMember = useDeleteTeamMember();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MemberForm>(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | TeamRole>('all');

  const members = allMembers.filter(
    m => filter === 'all' || m.role === filter
  );

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (m: DbTeamMember) => {
    setEditingId(m.id);
    setForm({ name: m.name, email: m.email, phone: m.phone, role: m.role as TeamRole, roles: [m.role as TeamRole], crew_name: m.crew_name || '' });
    setDialogOpen(true);
  };

  const toggleRole = (role: TeamRole) => {
    setForm(f => {
      const newRoles = f.roles.includes(role)
        ? f.roles.filter(r => r !== role)
        : [...f.roles, role];
      // Ensure at least one role is selected
      if (newRoles.length === 0) return f;
      // Set primary role to the first selected
      const primaryRole = newRoles.includes(f.role) ? f.role : newRoles[0];
      return { ...f, roles: newRoles, role: primaryRole };
    });
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      toast({ title: t('team.nameRequired'), variant: 'destructive' });
      return;
    }
    if (form.roles.length === 0) {
      toast({ title: 'At least one role is required', variant: 'destructive' });
      return;
    }
    try {
      if (editingId) {
        await updateMember.mutateAsync({ id: editingId, name: form.name, email: form.email, phone: form.phone, role: form.role, crew_name: form.roles.includes('subcontractor') ? form.crew_name : null });
        toast({ title: t('team.memberUpdated') });
      } else {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          toast({ title: t('team.sessionExpired'), description: t('team.sessionExpiredDesc'), variant: 'destructive' });
          navigate('/');
          return;
        }

        const res = await supabase.functions.invoke('invite-member', {
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: {
            email: form.email,
            name: form.name,
            role: form.role,
            roles: form.roles,
            phone: form.phone,
            crew_name: form.roles.includes('subcontractor') ? form.crew_name : null,
            redirect_url: `https://drawpals.lovable.app/reset-password`,
          },
        });

        if (res.error) throw new Error(res.error.message || 'Failed to send invitation');
        if (res.data?.error) throw new Error(res.data.error);

        toast({ title: t('team.inviteSent'), description: t('team.inviteDesc', { email: form.email }) });
      }
      setDialogOpen(false);
    } catch (e: any) {
      toast({ title: t('common.error'), description: e.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMember.mutateAsync(id);
      toast({ title: t('team.memberRemoved') });
      setDeleteConfirm(null);
    } catch (e: any) {
      toast({ title: t('common.error'), description: e.message, variant: 'destructive' });
    }
  };

  const roleIcon = (role: string) => role === 'admin' ? <Shield className="w-4 h-4" /> : role === 'subcontractor' ? <HardHat className="w-4 h-4" /> : <Briefcase className="w-4 h-4" />;
  const roleLabel = (role: string) => role === 'admin' ? t('team.roles.admin') : role === 'subcontractor' ? t('team.roles.subcontractor') : t('team.roles.project-manager');
  const roleColor = (role: string) => role === 'admin' ? 'bg-primary/15 text-primary' : role === 'subcontractor' ? 'bg-info/15 text-info' : 'bg-accent/15 text-accent';

  const allRoles: TeamRole[] = ['admin', 'project-manager', 'subcontractor'];

  return (
    <>
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-primary" />
            <h2 className="font-display font-bold text-xl">{t('team.title')}</h2>
          </div>
          <Button onClick={openCreate} className="font-display">
            <Plus className="w-4 h-4 mr-1" /> {t('team.addMember')}
          </Button>
        </div>

        <div className="flex gap-2">
          {(['all', 'admin', 'project-manager', 'subcontractor'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-full text-sm font-body whitespace-nowrap transition-colors ${
                filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'
              }`}
            >
              {f === 'all' ? t('team.all') : f === 'admin' ? t('team.admins') : f === 'subcontractor' ? t('team.subcontractors') : t('team.projectManagers')}
            </button>
          ))}
        </div>

        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}

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
                      <p className="text-sm font-body">{t('team.removeConfirm')} <strong>{m.name}</strong>?</p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="destructive" onClick={() => handleDelete(m.id)} disabled={deleteMember.isPending}>
                          <Check className="w-3 h-3 mr-1" /> {t('common.yes')}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setDeleteConfirm(null)}>
                          <X className="w-3 h-3 mr-1" /> {t('common.no')}
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
                      {m.crew_name && <p className="text-xs text-muted-foreground/70 font-body mt-0.5">{t('team.crew')} {m.crew_name}</p>}
                    </>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {!isLoading && members.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground font-body">
                {t('team.noMembers')}
              </div>
            )}
          </div>
        )}
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">{editingId ? t('team.editMember') : t('team.addMemberTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium font-body mb-1.5 block">{t('common.name')} *</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={t('team.namePlaceholder')} />
            </div>
            <div>
              <label className="text-sm font-medium font-body mb-1.5 block">{t('common.email')} *</label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder={t('team.emailPlaceholder')} />
            </div>
            <div>
              <label className="text-sm font-medium font-body mb-1.5 block">{t('common.phone')}</label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder={t('team.phonePlaceholder')} />
            </div>
            <div>
              <label className="text-sm font-medium font-body mb-2 block">{t('common.role', 'Roles')} *</label>
              <div className="space-y-2">
                {allRoles.map(role => (
                  <label key={role} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={form.roles.includes(role)}
                      onCheckedChange={() => toggleRole(role)}
                    />
                    <span className="flex items-center gap-1.5 text-sm font-body">
                      {roleIcon(role)}
                      {roleLabel(role)}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            {editingId && (
              <div>
                <label className="text-sm font-medium font-body mb-1.5 block">Primary Role</label>
                <Select value={form.role} onValueChange={(v: TeamRole) => setForm(f => ({ ...f, role: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {form.roles.map(r => (
                      <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {form.roles.includes('subcontractor') && (
              <div>
                <label className="text-sm font-medium font-body mb-1.5 block">{t('team.crewName')}</label>
                <Input value={form.crew_name} onChange={e => setForm(f => ({ ...f, crew_name: e.target.value }))} placeholder={t('team.crewPlaceholder')} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} disabled={createMember.isPending || updateMember.isPending}>
              {(createMember.isPending || updateMember.isPending) && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {editingId ? t('common.save') : <><Send className="w-4 h-4 mr-1" /> {t('team.sendInvite')}</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TeamManagement;
