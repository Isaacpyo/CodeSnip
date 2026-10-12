import { ChakraProvider } from '@chakra-ui/react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { AuthProvider } from './auth/AuthProvider';
import { BackendContext, type BackendContextValue } from './backend/context';
import { ColorModeProvider } from './ui/ColorModeProvider';
import { system } from './ui/system';
import { Toaster } from './ui/Toaster';

export function AppProviders({
  backend,
  queryClient,
  children,
}: {
  backend: BackendContextValue;
  queryClient: QueryClient;
  children: ReactNode;
}) {
  return (
    <ChakraProvider value={system}>
      <ColorModeProvider>
        <QueryClientProvider client={queryClient}>
          <BackendContext.Provider value={backend}>
            <AuthProvider>
              {children}
              <Toaster />
            </AuthProvider>
          </BackendContext.Provider>
        </QueryClientProvider>
      </ColorModeProvider>
    </ChakraProvider>
  );
}
