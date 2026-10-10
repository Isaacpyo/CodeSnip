import { Box, CloseButton, Container, HStack, Text } from '@chakra-ui/react';
import { FlaskConical } from 'lucide-react';
import { useState } from 'react';
import { useBackend } from '../backend/context';

const DISMISS_KEY = 'codesnip:mock-notice-dismissed';

function readDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

/** Honest label for the in-browser mock backend. */
export function MockModeNotice() {
  const backend = useBackend();
  const [dismissed, setDismissed] = useState(readDismissed);
  if (backend.kind !== 'mock' || dismissed) return null;

  return (
    <Box
      bg="orange.subtle"
      color="orange.fg"
      fontSize="sm"
      borderBottomWidth="1px"
      borderColor="orange.muted"
    >
      <Container maxW="7xl" py="1.5" px={{ base: '3', md: '6' }}>
        <HStack justify="space-between" gap="3">
          <HStack gap="2">
            <FlaskConical size={16} aria-hidden />
            <Text>
              <strong>Offline demo mode.</strong> No backend is configured, so data is stored in
              this browser only.
            </Text>
          </HStack>
          <CloseButton
            size="2xs"
            aria-label="Dismiss demo mode notice"
            onClick={() => {
              try {
                sessionStorage.setItem(DISMISS_KEY, '1');
              } catch {
                // ignore
              }
              setDismissed(true);
            }}
          />
        </HStack>
      </Container>
    </Box>
  );
}
