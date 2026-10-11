import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useBackend } from '../backend/context';
import type { AuthUser } from '../backend/types';
import { AuthContext, type AuthStatus } from './context';

/** Tracks the signed-in user and drops cached data whenever the user changes. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const backend = useBackend();
  const queryClient = useQueryClient();
  const [state, setState] = useState<{
    user: AuthUser | null;
    status: AuthStatus;
    signedOutByUser: boolean;
  }>({ user: null, status: 'loading', signedOutByUser: false });
  const userId = useRef<string | null | undefined>(undefined);

  const apply = useCallback(
    (user: AuthUser | null, byUser = false) => {
      const nextId = user?.id ?? null;
      if (userId.current !== undefined && userId.current !== nextId) {
        queryClient.removeQueries({ queryKey: ['snippets'] });
        queryClient.removeQueries({ queryKey: ['profile'] });
      }
      userId.current = nextId;
      setState((prev) => ({
        user,
        status: user ? 'signed-in' : 'signed-out',
        signedOutByUser: user ? false : byUser || prev.signedOutByUser,
      }));
    },
    [queryClient],
  );

  useEffect(() => {
    let active = true;
    const unsubscribe = backend.auth.onChange((user) => {
      if (active) apply(user);
    });
    backend.auth.getUser().then(
      (user) => active && apply(user),
      () => active && apply(null),
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [backend, apply]);

  const signOut = useCallback(async () => {
    await backend.auth.signOut();
    apply(null, true);
  }, [backend, apply]);

  const value = useMemo(() => ({ ...state, signOut }), [state, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
