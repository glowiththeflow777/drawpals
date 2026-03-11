import { Shield, Briefcase, HardHat } from 'lucide-react';
import { useActiveRole, type AppRole } from '@/hooks/useAuth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

const roleConfig: Record<AppRole, { icon: typeof Shield; label: string; key: string }> = {
  admin: { icon: Shield, label: 'Admin', key: 'team.roles.admin' },
  'project-manager': { icon: Briefcase, label: 'Project Manager', key: 'team.roles.project-manager' },
  subcontractor: { icon: HardHat, label: 'Subcontractor', key: 'team.roles.subcontractor' },
};

export default function RoleSwitcher() {
  const { activeRole, setActiveRole, roles } = useActiveRole();
  const { t } = useTranslation();

  // Only show if user has multiple roles
  if (roles.length <= 1) return null;

  const active = roleConfig[activeRole];
  const ActiveIcon = active.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-secondary-foreground/10 text-secondary-foreground hover:bg-secondary-foreground/20 transition-colors">
          <ActiveIcon className="w-3.5 h-3.5" />
          {t(active.key, active.label)}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {roles.map(role => {
          const config = roleConfig[role];
          const Icon = config.icon;
          return (
            <DropdownMenuItem
              key={role}
              onClick={() => setActiveRole(role)}
              className={cn('gap-2 cursor-pointer', role === activeRole && 'bg-accent')}
            >
              <Icon className="w-4 h-4" />
              {t(config.key, config.label)}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
