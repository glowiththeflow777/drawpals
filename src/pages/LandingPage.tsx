import { useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, HardHat, ArrowRight, Mail, Lock, Loader2, User, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

const LandingPage = () => {
  const { t, i18n } = useTranslation();
  const [mode, setMode] = useState<'landing' | 'login' | 'setup'>('landing');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [setupName, setSetupName] = useState('');
  const [setupEmail, setSetupEmail] = useState('');
  const [setupPassword, setSetupPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const [setupAvailable] = useState(false);

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'es' : 'en';
    i18n.changeLanguage(newLang);
    localStorage.setItem('lang', newLang);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setLoading(false);
      toast({ title: t('landing.signInFailed'), description: error.message, variant: 'destructive' });
      return;
    }

    // Fetch user roles to determine where to route
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: roles } = await supabase.rpc('get_user_roles', { _user_id: user.id });
      const userRoles = (roles || []) as string[];
      
      // Restore last active role or pick best default
      const stored = localStorage.getItem('activeRole');
      if (stored && userRoles.includes(stored)) {
        navigate(stored === 'subcontractor' ? '/dashboard' : '/admin');
      } else if (userRoles.includes('admin')) {
        localStorage.setItem('activeRole', 'admin');
        navigate('/admin');
      } else if (userRoles.includes('project-manager')) {
        localStorage.setItem('activeRole', 'project-manager');
        navigate('/admin');
      } else {
        localStorage.setItem('activeRole', 'subcontractor');
        navigate('/dashboard');
      }
    }
    setLoading(false);
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (setupPassword.length < 6) {
      toast({ title: t('landing.setup.passwordTooShort'), variant: 'destructive' });
      return;
    }
    setLoading(true);
    const res = await supabase.functions.invoke('setup-admin', {
      body: { email: setupEmail, password: setupPassword, name: setupName },
    });
    setLoading(false);

    if (res.error || res.data?.error) {
      toast({ title: t('common.error'), description: res.data?.error || res.error?.message, variant: 'destructive' });
    } else {
      toast({ title: t('landing.setup.successTitle'), description: t('landing.setup.successDesc') });
      setEmail(setupEmail);
      setMode('login');
    }
  };

  if (mode === 'setup') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <button onClick={() => setMode('landing')} className="text-muted-foreground text-sm mb-6 hover:text-foreground transition-colors">{t('common.back')}</button>
          <div className="card-elevated p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
                <Building2 className="w-5 h-5 text-primary-foreground" />
              </div>
              <h2 className="text-2xl font-display font-bold">{t('landing.setup.title')}</h2>
            </div>
            <p className="text-muted-foreground font-body text-sm mb-4">{t('landing.setup.description')}</p>
            <form onSubmit={handleSetup} className="space-y-4">
              <div>
                <Label htmlFor="setup-name" className="font-body">{t('landing.setup.fullName')}</Label>
                <div className="relative mt-1">
                  <User className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input id="setup-name" placeholder={t('landing.setup.fullNamePlaceholder')} className="pl-10" value={setupName} onChange={e => setSetupName(e.target.value)} required />
                </div>
              </div>
              <div>
                <Label htmlFor="setup-email" className="font-body">{t('landing.emailLabel')}</Label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input id="setup-email" type="email" placeholder={t('landing.emailPlaceholder')} className="pl-10" value={setupEmail} onChange={e => setSetupEmail(e.target.value)} required />
                </div>
              </div>
              <div>
                <Label htmlFor="setup-password" className="font-body">{t('landing.passwordLabel')}</Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input id="setup-password" type="password" placeholder={t('landing.passwordPlaceholder')} className="pl-10" value={setupPassword} onChange={e => setSetupPassword(e.target.value)} required />
                </div>
              </div>
              <Button type="submit" className="w-full gradient-primary text-primary-foreground py-6 text-lg font-display rounded-xl" disabled={loading}>
                {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                {t('landing.setup.createBtn')}
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
          <div className="absolute top-4 right-4 z-20">
            <Button variant="ghost" size="sm" onClick={toggleLanguage} className="text-secondary-foreground/50 hover:text-secondary-foreground flex items-center gap-1">
              <Globe className="w-4 h-4" />
              <span className="text-xs font-medium">{i18n.language === 'en' ? 'ES' : 'EN'}</span>
            </Button>
          </div>
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-20 left-10 w-64 h-64 rounded-full bg-primary blur-[100px]" />
            <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full bg-accent blur-[120px]" />
          </div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center max-w-2xl relative z-10">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
                <Building2 className="w-6 h-6 text-primary-foreground" />
              </div>
              <h1 className="text-3xl md:text-4xl font-display font-bold text-secondary-foreground">{t('common.appName')}</h1>
            </div>
            <p className="text-secondary-foreground/50 font-body mb-10 max-w-lg mx-auto">
              {t('landing.tagline')}
            </p>

            <div className="flex justify-center">
              <Button size="lg" className="gradient-primary text-primary-foreground font-display text-lg px-8 py-6 rounded-xl shadow-lg hover:opacity-90 transition-opacity" onClick={() => setMode('login')}>
                <ArrowRight className="w-5 h-5 mr-2" />
                {t('landing.signIn', 'Sign In')}
              </Button>
            </div>

            {setupAvailable && (
              <p className="text-secondary-foreground/30 text-sm mt-8 font-body">
                {t('landing.firstTime')}{' '}
                <button onClick={() => setMode('setup')} className="text-primary underline underline-offset-2">
                  {t('landing.setupLink')}
                </button>
              </p>
            )}
          </motion.div>
        </div>
      </div>
    );
  }

  // Unified login — no role selection needed
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <button onClick={() => setMode('landing')} className="text-muted-foreground text-sm mb-6 hover:text-foreground transition-colors">{t('common.back')}</button>
        <div className="card-elevated p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary-foreground" />
            </div>
            <h2 className="text-2xl font-display font-bold">{t('landing.signIn', 'Sign In')}</h2>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label htmlFor="login-email" className="font-body">{t('landing.emailLabel')}</Label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input id="login-email" type="email" placeholder={t('landing.emailPlaceholder')} className="pl-10" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
            </div>
            <div>
              <Label htmlFor="login-password" className="font-body">{t('landing.passwordLabel')}</Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input id="login-password" type="password" placeholder={t('landing.passwordPlaceholder')} className="pl-10" value={password} onChange={e => setPassword(e.target.value)} required />
              </div>
            </div>
            <Button type="submit" className="w-full gradient-primary text-primary-foreground py-6 text-lg font-display rounded-xl" disabled={loading}>
              {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
              {t('landing.signIn', 'Sign In')} <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </form>
          <div className="text-center mt-4">
            <button onClick={() => navigate('/forgot-password')} className="text-sm text-primary font-medium hover:underline">
              {t('landing.forgotPassword')}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default LandingPage;
