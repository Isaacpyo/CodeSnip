import {
  Box,
  Container,
  Flex,
  HStack,
  Link,
  SkipNavContent,
  SkipNavLink,
  Text,
} from '@chakra-ui/react';
import { Outlet } from 'react-router';
import { Header } from './Header';
import { MockModeNotice } from './MockModeNotice';
import { WakeBanner } from './WakeBanner';

export function AppShell() {
  return (
    <Flex direction="column" minHeight="100dvh">
      <SkipNavLink>Skip to content</SkipNavLink>
      <MockModeNotice />
      <Header />
      <WakeBanner />
      <SkipNavContent />
      <Box as="main" flex="1" py={{ base: '4', md: '8' }}>
        <Outlet />
      </Box>
      <Box as="footer" borderTopWidth="1px" py="4" fontSize="sm" color="fg.muted">
        <Container maxW="7xl" px={{ base: '3', md: '6' }}>
          <HStack justify="space-between" flexWrap="wrap" gap="2">
            <Text>CodeSnip · React, Supabase, Monaco and Chakra UI</Text>
            <Link
              href="https://github.com/temitopeagbola/CodeSnip"
              target="_blank"
              rel="noreferrer"
            >
              Source on GitHub
            </Link>
          </HStack>
        </Container>
      </Box>
    </Flex>
  );
}
