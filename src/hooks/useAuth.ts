import { useEffect, useState, createContext, useContext } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import type { User } from '@supabase/supabase-js';

export type AppRole = 'admin' | 'project-manager' | 'subcontractor';

export function useCurrentUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { user, loading };
}

export function useCurrentProfile() {
  const { user } = useCurrentUser();
  return useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useUserRoles() {
  const { user } = useCurrentUser();
  return useQuery({
    queryKey: ['user_roles', user?.id],
    queryFn: async () => {
      if (!user) return [] as AppRole[];
      const { data, error } = await supabase.rpc('get_user_roles', { _user_id: user.id });
      if (error) throw error;
      return (data || []) as AppRole[];
    },
    enabled: !!user,
  });
}

// Active role context
interface ActiveRoleContextType {
  activeRole: AppRole;
  setActiveRole: (role: AppRole) => void;
  roles: AppRole[];
  hasRole: (role: AppRole) => boolean;
}

const ActiveRoleContext = createContext<ActiveRoleContextType>({
  activeRole: 'subcontractor',
  setActiveRole: () => {},
  roles: [],
  hasRole: () => false,
});

export const ActiveRoleProvider = ActiveRoleContext.Provider;
export const useActiveRole = () => useContext(ActiveRoleContext);
