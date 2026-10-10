import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useBackend } from '../backend/context';
import type { AuthUser } from '../backend/types';
import { AuthContext, type AuthContextValue } from './context';

/** Tracks the signed-in user and drops cached data whenever the user changes. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const backend = useBackend();
  const queryClient = useQueryClient();
  const [value, setValue] = useState<AuthContextValue>({ user: null, status: 'loading' });
  const userId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    const apply = (user: AuthUser | null) => {
      if (!active) return;
      if (userId.current !== undefined && userId.current !== (user?.id ?? null)) {
        queryClient.removeQueries({ queryKey: ['snippets'] });
        queryClient.removeQueries({ queryKey: ['profile'] });
      }
      userId.current = user?.id ?? null;
      setValue({ user, status: user ? 'signed-in' : 'signed-out' });
    };
    const unsubscribe = backend.auth.onChange(apply);
    backend.auth.getUser().then(apply, () => apply(null));
    return () => {
      active = false;
      unsubscribe();
    };
  }, [backend, queryClient]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
