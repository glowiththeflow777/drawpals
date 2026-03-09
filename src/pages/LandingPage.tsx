import { useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, HardHat, ArrowRight, Mail, Lock, Loader2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const LandingPage = () => {
  const [mode, setMode] = useState<'landing' | 'login' | 'setup'>('landing');
  const [role, setRole] = useState<'subcontractor' | 'admin'>('subcontractor');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [setupName, setSetupName] = useState('');
  const [setupEmail, setSetupEmail] = useState('');
  const [setupPassword, setSetupPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Check if setup is still available (no auth users yet)
  const [setupAvailable, setSetupAvailable] = useState(false);

  // Try to detect if setup was already done by attempting a quick check
  useState(() => {
    supabase.functions.invoke('setup-admin', { body: { check: true } }).then(res => {
      // If we get 403, setup is done; otherwise it might still be available
      if (res.error || res.data?.error?.includes('already')) {
        setSetupAvailable(false);
      }
    }).catch(() => setSetupAvailable(false));
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      toast({ title: 'Sign in failed', description: error.message, variant: 'destructive' });
    } else {
      navigate(role === 'admin' ? '/admin' : '/dashboard');
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (setupPassword.length < 6) {
      toast({ title: 'Password must be at least 6 characters', variant: 'destructive' });
      return;
    }
    setLoading(true);
    const res = await supabase.functions.invoke('setup-admin', {
      body: { email: setupEmail, password: setupPassword, name: setupName },
    });
    setLoading(false);

    if (res.error || res.data?.error) {
      toast({ title: 'Error', description: res.data?.error || res.error?.message, variant: 'destructive' });
    } else {
      toast({ title: 'Admin account created!', description: 'You can now sign in.' });
      setEmail(setupEmail);
      setMode('login');
      setRole('admin');
    }
  };

  if (mode === 'setup') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <button onClick={() => setMode('landing')} className="text-muted-foreground text-sm mb-6 hover:text-foreground transition-colors">← Back</button>
          <div className="card-elevated p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
                <Building2 className="w-5 h-5 text-primary-foreground" />
              </div>
              <h2 className="text-2xl font-display font-bold">First Time Setup</h2>
            </div>
            <p className="text-muted-foreground font-body text-sm mb-4">Create your admin account to get started.</p>
            <form onSubmit={handleSetup} className="space-y-4">
              <div>
                <Label htmlFor="setup-name" className="font-body">Full Name</Label>
                <div className="relative mt-1">
                  <User className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input id="setup-name" placeholder="John Doe" className="pl-10" value={setupName} onChange={e => setSetupName(e.target.value)} required />
                </div>
              </div>
              <div>
                <Label htmlFor="setup-email" className="font-body">Email</Label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input id="setup-email" type="email" placeholder="you@email.com" className="pl-10" value={setupEmail} onChange={e => setSetupEmail(e.target.value)} required />
                </div>
              </div>
              <div>
                <Label htmlFor="setup-password" className="font-body">Password</Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input id="setup-password" type="password" placeholder="••••••••" className="pl-10" value={setupPassword} onChange={e => setSetupPassword(e.target.value)} required />
                </div>
              </div>
              <Button type="submit" className="w-full gradient-primary text-primary-foreground py-6 text-lg font-display rounded-xl" disabled={loading}>
                {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                Create Admin Account
              </Button>
            </form>
          </div>
        </motion.div>
      </div>
    );
  }

  if (mode === 'landing') {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="gradient-dark flex-1 flex items-center justify-center px-4 py-16 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-20 left-10 w-64 h-64 rounded-full bg-primary blur-[100px]" />
            <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full bg-accent blur-[120px]" />
          </div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center max-w-2xl relative z-10">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
                <Building2 className="w-6 h-6 text-primary-foreground" />
              </div>
              <h1 className="text-3xl md:text-4xl font-display font-bold text-secondary-foreground">Budget Builder</h1>
            </div>
            <p className="text-secondary-foreground/50 font-body mb-10 max-w-lg mx-auto">
              Submit invoices, track budgets, and get paid — all from your phone. Built for the field.
            </p>

            <div className="flex justify-center">
              <Button size="lg" className="gradient-primary text-primary-foreground font-display text-lg px-8 py-6 rounded-xl shadow-lg hover:opacity-90 transition-opacity" onClick={() => { setRole('subcontractor'); setMode('login'); }}>
                <HardHat className="w-5 h-5 mr-2" />
                I'm a Subcontractor
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>

            <div className="flex justify-center mt-2">
              <Button size="sm" variant="ghost" className="text-secondary-foreground/40 font-body text-sm hover:text-secondary-foreground/60 transition-colors" onClick={() => { setRole('admin'); setMode('login'); }}>
                <Building2 className="w-4 h-4 mr-1" />
                Admin Login
              </Button>
            </div>

            {setupAvailable && (
              <p className="text-secondary-foreground/30 text-sm mt-8 font-body">
                First time?{' '}
                <button onClick={() => setMode('setup')} className="text-primary underline underline-offset-2">
                  Set up your admin account
                </button>
              </p>
            )}
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <button onClick={() => setMode('landing')} className="text-muted-foreground text-sm mb-6 hover:text-foreground transition-colors">← Back</button>
        <div className="card-elevated p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
              {role === 'admin' ? <Building2 className="w-5 h-5 text-primary-foreground" /> : <HardHat className="w-5 h-5 text-primary-foreground" />}
            </div>
            <h2 className="text-2xl font-display font-bold">{role === 'admin' ? 'Admin Sign In' : 'Sign In'}</h2>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label htmlFor="login-email" className="font-body">Email</Label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input id="login-email" type="email" placeholder="you@email.com" className="pl-10" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
            </div>
            <div>
              <Label htmlFor="login-password" className="font-body">Password</Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input id="login-password" type="password" placeholder="••••••••" className="pl-10" value={password} onChange={e => setPassword(e.target.value)} required />
              </div>
            </div>
            <Button type="submit" className="w-full gradient-primary text-primary-foreground py-6 text-lg font-display rounded-xl" disabled={loading}>
              {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
              Sign In <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </form>
          <div className="text-center mt-4">
            <button onClick={() => navigate('/forgot-password')} className="text-sm text-primary font-medium hover:underline">
              Forgot your password?
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default LandingPage;
