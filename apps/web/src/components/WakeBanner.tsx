import { Alert, Box, Spinner } from '@chakra-ui/react';
import { useSyncExternalStore } from 'react';
import { useWakeTracker } from '../backend/context';

/** Shown while a backend request is unusually slow (sleeping free-tier server). */
export function WakeBanner() {
  const tracker = useWakeTracker();
  const state = useSyncExternalStore(tracker.subscribe, tracker.getState, tracker.getState);

  return (
    <Box role="status" aria-live="polite" position="sticky" top="0" zIndex="banner">
      {state !== 'idle' && (
        <Alert.Root status="info" borderRadius="0" py="2" data-testid="wake-banner">
          <Spinner size="sm" color="blue.solid" />
          <Alert.Content>
            <Alert.Title>
              {state === 'slow' ? 'Waking up the server…' : 'Still waking up…'}
            </Alert.Title>
            <Alert.Description>
              {state === 'slow'
                ? 'Free-tier backends sleep when idle, so the first request can take a few seconds.'
                : 'This is taking longer than usual. If it doesn’t finish, the backend may be paused; try again in a minute.'}
            </Alert.Description>
          </Alert.Content>
        </Alert.Root>
      )}
    </Box>
  );
}
