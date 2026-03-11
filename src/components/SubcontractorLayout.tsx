import { Building2, LogOut, FileText, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import NotificationBell from '@/components/NotificationBell';

export default function SubcontractorLayout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const { t } = useTranslation();

  const tabs = [
    { label: t('nav.invoices'), path: '/dashboard', icon: FileText },
    { label: t('nav.newInvoice'), path: '/invoice/new', icon: Plus },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-dark px-4 pt-4 pb-0 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center">
              <Building2 className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display font-bold text-secondary-foreground text-sm">{t('common.appName')}</h1>
              <p className="text-secondary-foreground/50 text-xs">{t('nav.subcontractorPortal')}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <LanguageSwitcher />
            <Link to="/">
              <Button variant="ghost" size="sm" className="text-secondary-foreground/50 hover:text-secondary-foreground">
                <LogOut className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
        <nav className="max-w-4xl mx-auto flex gap-1">
          {tabs.map(t => {
            const active = pathname === t.path;
            return (
              <Link
                key={t.path}
                to={t.path}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2.5 text-sm font-display font-medium rounded-t-lg transition-colors',
                  active
                    ? 'bg-background text-foreground'
                    : 'text-secondary-foreground/50 hover:text-secondary-foreground/80 hover:bg-secondary-foreground/5'
                )}
              >
                <t.icon className="w-4 h-4" />
                {t.label}
              </Link>
            );
          })}
        </nav>
      </header>
      {children}
    </div>
  );
}
