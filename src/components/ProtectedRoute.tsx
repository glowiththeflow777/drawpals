import { Navigate } from 'react-router-dom';
import { useActiveRole, type AppRole } from '@/hooks/useAuth';
import { useAuth } from '@/components/AuthProvider';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: AppRole[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const { activeRole, roles } = useActiveRole();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  // If specific roles required, check the user has at least one
  if (allowedRoles && allowedRoles.length > 0) {
    const hasAccess = allowedRoles.some(r => roles.includes(r));
    if (!hasAccess) {
      // Redirect to their default portal
      return <Navigate to={activeRole === 'subcontractor' ? '/dashboard' : '/admin'} replace />;
    }
  }

  return <>{children}</>;
}
