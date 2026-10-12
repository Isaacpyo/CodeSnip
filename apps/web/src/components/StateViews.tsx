import {
  Alert,
  Button,
  Card,
  EmptyState,
  HStack,
  SimpleGrid,
  Skeleton,
  SkeletonText,
  VStack,
} from '@chakra-ui/react';
import { RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { friendlyMessage } from '../backend/errors';

export function ErrorView({
  error,
  title = 'Couldn’t load this',
  onRetry,
}: {
  error: unknown;
  title?: string;
  onRetry?: () => void;
}) {
  return (
    <Alert.Root status="error" borderRadius="lg" alignItems="flex-start" role="alert">
      <Alert.Indicator />
      <Alert.Content gap="2">
        <Alert.Title>{title}</Alert.Title>
        <Alert.Description>{friendlyMessage(error)}</Alert.Description>
        {onRetry && (
          <Button size="sm" variant="outline" alignSelf="flex-start" onClick={onRetry}>
            <RefreshCw /> Try again
          </Button>
        )}
      </Alert.Content>
    </Alert.Root>
  );
}

export function EmptyView({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <EmptyState.Root borderWidth="1px" borderStyle="dashed" borderRadius="xl" size="md">
      <EmptyState.Content>
        <EmptyState.Indicator>{icon}</EmptyState.Indicator>
        <VStack textAlign="center">
          <EmptyState.Title>{title}</EmptyState.Title>
          {description && <EmptyState.Description>{description}</EmptyState.Description>}
        </VStack>
        {children && (
          <HStack gap="2" flexWrap="wrap" justify="center">
            {children}
          </HStack>
        )}
      </EmptyState.Content>
    </EmptyState.Root>
  );
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <SimpleGrid
      columns={{ base: 1, md: 2, xl: 3 }}
      gap="4"
      aria-busy="true"
      aria-label="Loading snippets"
    >
      {Array.from({ length: count }, (_, i) => (
        <Card.Root key={i} variant="outline">
          <Card.Body gap="3">
            <Skeleton height="5" width="70%" />
            <SkeletonText noOfLines={2} />
            <Skeleton height="20" />
            <HStack>
              <Skeleton height="5" width="16" />
              <Skeleton height="5" width="12" />
            </HStack>
          </Card.Body>
        </Card.Root>
      ))}
    </SimpleGrid>
  );
}
