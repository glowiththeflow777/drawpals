import { useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, HardHat, ArrowRight, Mail, Lock, User, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useNavigate } from 'react-router-dom';

const LandingPage = () => {
  const [mode, setMode] = useState<'landing' | 'login' | 'signup'>('landing');
  const [role, setRole] = useState<'subcontractor' | 'admin'>('subcontractor');
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(role === 'admin' ? '/admin' : '/dashboard');
  };

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    navigate('/dashboard');
  };

  if (mode === 'landing') {
    return (
      <div className="min-h-screen flex flex-col">
        {/* Hero */}
        <div className="gradient-dark flex-1 flex items-center justify-center px-4 py-16 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-20 left-10 w-64 h-64 rounded-full bg-primary blur-[100px]" />
            <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full bg-accent blur-[120px]" />
          </div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-2xl relative z-10"
          >
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
                <Building2 className="w-6 h-6 text-primary-foreground" />
              </div>
              <h1 className="text-3xl md:text-4xl font-display font-bold text-secondary-foreground">
                Budget Builder
              </h1>
            </div>
            <p className="text-lg md:text-xl text-secondary-foreground/70 font-body mb-2">
              by Space Cowboy
            </p>
            <p className="text-secondary-foreground/50 font-body mb-10 max-w-lg mx-auto">
              Submit invoices, track budgets, and get paid — all from your phone. Built for the field.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                className="gradient-primary text-primary-foreground font-display text-lg px-8 py-6 rounded-xl shadow-lg hover:opacity-90 transition-opacity"
                onClick={() => { setRole('subcontractor'); setMode('login'); }}
              >
                <HardHat className="w-5 h-5 mr-2" />
                I'm a Subcontractor
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-secondary-foreground/20 text-secondary-foreground font-display text-lg px-8 py-6 rounded-xl hover:bg-secondary-foreground/5 transition-colors"
                onClick={() => { setRole('admin'); setMode('login'); }}
              >
                <Building2 className="w-5 h-5 mr-2" />
                Admin Login
              </Button>
            </div>

            <p className="text-secondary-foreground/30 text-sm mt-8 font-body">
              New subcontractor?{' '}
              <button
                onClick={() => { setRole('subcontractor'); setMode('signup'); }}
                className="text-primary underline underline-offset-2"
              >
                Create an account
              </button>
            </p>
          </motion.div>
        </div>
      </div>
    );
  }

  if (mode === 'signup') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <button onClick={() => setMode('landing')} className="text-muted-foreground text-sm mb-6 hover:text-foreground transition-colors">
            ← Back
          </button>
          <div className="card-elevated p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
                <HardHat className="w-5 h-5 text-primary-foreground" />
              </div>
              <h2 className="text-2xl font-display font-bold">Create Account</h2>
            </div>
            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <Label htmlFor="name" className="font-body">Full Name</Label>
                <div className="relative mt-1">
                  <User className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input id="name" placeholder="John Doe" className="pl-10" required />
                </div>
              </div>
              <div>
                <Label htmlFor="crew" className="font-body">Crew Name</Label>
                <Input id="crew" placeholder="e.g. Gloria's Crew" className="mt-1" required />
              </div>
              <div>
                <Label htmlFor="email" className="font-body">Email</Label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input id="email" type="email" placeholder="you@email.com" className="pl-10" required />
                </div>
              </div>
              <div>
                <Label htmlFor="phone" className="font-body">Phone</Label>
                <div className="relative mt-1">
                  <Phone className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input id="phone" type="tel" placeholder="512-555-0123" className="pl-10" required />
                </div>
              </div>
              <div>
                <Label htmlFor="password" className="font-body">Password</Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input id="password" type="password" placeholder="••••••••" className="pl-10" required />
                </div>
              </div>
              <Button type="submit" className="w-full gradient-primary text-primary-foreground py-6 text-lg font-display rounded-xl">
                Create Account
              </Button>
            </form>
            <p className="text-center text-sm text-muted-foreground mt-4">
              Already have an account?{' '}
              <button onClick={() => setMode('login')} className="text-primary font-medium">Sign in</button>
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <button onClick={() => setMode('landing')} className="text-muted-foreground text-sm mb-6 hover:text-foreground transition-colors">
          ← Back
        </button>
        <div className="card-elevated p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
              {role === 'admin' ? <Building2 className="w-5 h-5 text-primary-foreground" /> : <HardHat className="w-5 h-5 text-primary-foreground" />}
            </div>
            <h2 className="text-2xl font-display font-bold">
              {role === 'admin' ? 'Admin Sign In' : 'Sign In'}
            </h2>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label htmlFor="login-email" className="font-body">Email</Label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input id="login-email" type="email" placeholder="you@email.com" className="pl-10" required />
              </div>
            </div>
            <div>
              <Label htmlFor="login-password" className="font-body">Password</Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input id="login-password" type="password" placeholder="••••••••" className="pl-10" required />
              </div>
            </div>
            <Button type="submit" className="w-full gradient-primary text-primary-foreground py-6 text-lg font-display rounded-xl">
              Sign In <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </form>
          {role === 'subcontractor' && (
            <p className="text-center text-sm text-muted-foreground mt-4">
              New here?{' '}
              <button onClick={() => setMode('signup')} className="text-primary font-medium">Create an account</button>
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default LandingPage;
