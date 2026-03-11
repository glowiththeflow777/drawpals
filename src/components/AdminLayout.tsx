import { Building2, LogOut, BarChart3, FolderOpen, Users, ClipboardCheck, FileText, ChevronDown, HardHat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import NotificationBell from '@/components/NotificationBell';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const tabs = [
    { label: t('nav.dashboard'), path: '/admin', icon: BarChart3 },
    { label: t('nav.projectsNav'), path: '/admin/projects', icon: FolderOpen },
    { label: t('nav.invoices'), path: '/admin/invoices', icon: FileText },
    { label: t('nav.approvals'), path: '/admin/approvals', icon: ClipboardCheck },
    { label: t('nav.team'), path: '/admin/team', icon: Users },
    { label: 'Sub Directory', path: '/admin/directory', icon: HardHat },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-dark px-4 pt-4 pb-0 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between mb-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 hover:opacity-80 transition-opacity focus:outline-none">
                <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-primary-foreground" />
                </div>
                <div className="text-left">
                  <h1 className="font-display font-bold text-secondary-foreground text-sm">{t('common.appName')}</h1>
                  <p className="text-secondary-foreground/50 text-xs">{t('nav.adminPortal')}</p>
                </div>
                <ChevronDown className="w-4 h-4 text-secondary-foreground/50" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {tabs.map(tab => {
                const active = pathname === tab.path;
                return (
                  <DropdownMenuItem
                    key={tab.path}
                    onClick={() => navigate(tab.path)}
                    className={cn('gap-2 cursor-pointer', active && 'bg-accent')}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/')} className="gap-2 cursor-pointer text-destructive">
                <LogOut className="w-4 h-4" />
                {t('common.logout', 'Log Out')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <LanguageSwitcher />
          </div>
        </div>
        <nav className="max-w-6xl mx-auto flex gap-1">
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
