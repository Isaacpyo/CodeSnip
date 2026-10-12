import { Center, Spinner, Text, Textarea, VStack } from '@chakra-ui/react';
import { Component, lazy, Suspense, type ReactNode } from 'react';
import type { CodeEditorProps } from './CodeEditor';

const CodeEditor = lazy(() => import('./CodeEditor'));

/** If Monaco fails to load (old browser, blocked chunk), fall back to a plain textarea. */
class EditorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function PlainEditor({ value, onChange, readOnly, ariaLabel, height }: CodeEditorProps) {
  return (
    <Textarea
      aria-label={ariaLabel}
      value={value}
      readOnly={readOnly}
      onChange={(e) => onChange?.(e.target.value)}
      height={height ?? '320px'}
      fontFamily="mono"
      fontSize="sm"
      bg="bg.subtle"
      spellCheck={false}
    />
  );
}

export function LazyCodeEditor(props: CodeEditorProps) {
  const loading = (
    <Center borderWidth="1px" borderRadius="md" height={props.height ?? '240px'} bg="bg.subtle">
      <VStack gap="2" color="fg.muted">
        <Spinner size="sm" />
        <Text fontSize="sm">Loading editor…</Text>
      </VStack>
    </Center>
  );
  return (
    <EditorBoundary fallback={<PlainEditor {...props} />}>
      <Suspense fallback={loading}>
        <CodeEditor {...props} />
      </Suspense>
    </EditorBoundary>
  );
}
