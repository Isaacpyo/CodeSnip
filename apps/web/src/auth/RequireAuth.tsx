import { Center, Spinner } from '@chakra-ui/react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from './context';

/**
 * Gate for /app routes: waits for the session, then redirects signed-out
 * visitors to /login (and back afterwards). Someone who just clicked
 * "Sign out" goes to the home page instead.
 */
export function RequireAuth() {
  const { status, signedOutByUser } = useAuth();
  const location = useLocation();
  if (status === 'loading') {
    return (
      <Center py="20">
        <Spinner size="lg" aria-label="Checking your session" />
      </Center>
    );
  }
  if (status === 'signed-out') {
    if (signedOutByUser) return <Navigate to="/" replace />;
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}
