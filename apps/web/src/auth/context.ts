import { createContext, useContext } from 'react';
import type { AuthUser } from '../backend/types';

export type AuthStatus = 'loading' | 'signed-in' | 'signed-out';

export interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
}

export const AuthContext = createContext<AuthContextValue>({ user: null, status: 'loading' });

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
