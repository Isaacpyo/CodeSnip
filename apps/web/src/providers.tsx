import { ChakraProvider } from '@chakra-ui/react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import type { ReactNode } from 'react';
import { AuthProvider } from './auth/AuthProvider';
import { BackendContext, type BackendContextValue } from './backend/context';
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
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <QueryClientProvider client={queryClient}>
          <BackendContext.Provider value={backend}>
            <AuthProvider>
              {children}
              <Toaster />
            </AuthProvider>
          </BackendContext.Provider>
        </QueryClientProvider>
      </ThemeProvider>
    </ChakraProvider>
  );
}
