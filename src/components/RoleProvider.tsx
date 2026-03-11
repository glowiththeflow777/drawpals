import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ActiveRoleProvider, useCurrentUser, useUserRoles, type AppRole } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

export default function RoleProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: userLoading } = useCurrentUser();
  const { data: roles = [], isLoading: rolesLoading } = useUserRoles();
  const navigate = useNavigate();
  const [activeRole, setActiveRole] = useState<AppRole>('subcontractor');

  // Restore from localStorage or pick best default
  useEffect(() => {
    if (roles.length === 0) return;
    const stored = localStorage.getItem('activeRole') as AppRole | null;
    if (stored && roles.includes(stored)) {
      setActiveRole(stored);
    } else if (roles.includes('admin')) {
      setActiveRole('admin');
    } else if (roles.includes('project-manager')) {
      setActiveRole('project-manager');
    } else {
      setActiveRole('subcontractor');
    }
  }, [roles]);

  const handleSetActiveRole = (role: AppRole) => {
    setActiveRole(role);
    localStorage.setItem('activeRole', role);
    // Navigate to the appropriate dashboard
    if (role === 'admin' || role === 'project-manager') {
      navigate('/admin');
    } else {
      navigate('/dashboard');
    }
  };

  const contextValue = useMemo(() => ({
    activeRole,
    setActiveRole: handleSetActiveRole,
    roles,
    hasRole: (role: AppRole) => roles.includes(role),
  }), [activeRole, roles]);

  if (userLoading || (user && rolesLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    // Not logged in — redirect to landing
    return null;
  }

  return (
    <ActiveRoleProvider value={contextValue}>
      {children}
    </ActiveRoleProvider>
  );
}
