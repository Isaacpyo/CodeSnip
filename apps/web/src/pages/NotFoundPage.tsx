import { Button, Container } from '@chakra-ui/react';
import { FileQuestion } from 'lucide-react';
import { Link as RouterLink, isRouteErrorResponse, useRouteError } from 'react-router';
import { EmptyView } from '../components/StateViews';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export function NotFoundPage({
  title = 'Page not found',
  description = 'The page you’re looking for doesn’t exist.',
}: {
  title?: string;
  description?: string;
}) {
  useDocumentTitle(title);
  return (
    <Container maxW="2xl" px="4">
      <EmptyView icon={<FileQuestion />} title={title} description={description}>
        <Button asChild colorPalette="teal">
          <RouterLink to="/">Go home</RouterLink>
        </Button>
        <Button asChild variant="outline">
          <RouterLink to="/explore">Explore snippets</RouterLink>
        </Button>
      </EmptyView>
    </Container>
  );
}

/** Router error boundary: unexpected render errors land here instead of a blank page. */
export function RouteErrorPage() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;
  console.error(error);
  return (
    <NotFoundPage
      title="Something went wrong"
      description="An unexpected error occurred. Reload the page, or head back home."
    />
  );
}
