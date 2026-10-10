import { Center, Spinner } from '@chakra-ui/react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from './context';

/** Gate for /app routes: waits for the session, then redirects to /login if signed out. */
export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') {
    return (
      <Center py="20">
        <Spinner size="lg" aria-label="Checking your session" />
      </Center>
    );
  }
  if (status === 'signed-out') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}
