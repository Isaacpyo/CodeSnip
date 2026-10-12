import { createContext, useContext } from 'react';
import type { AuthUser } from '../backend/types';

export type AuthStatus = 'loading' | 'signed-in' | 'signed-out';

export interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  /** True after the user signed out themselves (vs. a session that expired). */
  signedOutByUser: boolean;
  /** Signs out and updates auth state before resolving, so callers can navigate safely. */
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  status: 'loading',
  signedOutByUser: false,
  signOut: async () => {},
});

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
