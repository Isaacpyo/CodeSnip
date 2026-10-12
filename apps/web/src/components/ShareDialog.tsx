import {
  Button,
  CloseButton,
  Dialog,
  HStack,
  Input,
  Link,
  Portal,
  Stack,
  Text,
} from '@chakra-ui/react';
import { ExternalLink, Globe, Lock } from 'lucide-react';
import { useId } from 'react';
import type { Visibility } from '../backend/types';
import { shareUrl } from '../lib/format';
import { CopyButton } from './CopyButton';

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snippetId: string;
  visibility: Visibility;
  onChangeVisibility: (visibility: Visibility) => void;
  pending: boolean;
}

export function ShareDialog({
  open,
  onOpenChange,
  snippetId,
  visibility,
  onChangeVisibility,
  pending,
}: ShareDialogProps) {
  const url = shareUrl(snippetId);
  const inputId = useId();
  const isPublic = visibility === 'public';

  return (
    <Dialog.Root open={open} onOpenChange={(e) => onOpenChange(e.open)} placement="center">
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner px="4">
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Share snippet</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              {isPublic ? (
                <Stack gap="3">
                  <HStack gap="2" color="green.fg">
                    <Globe size={16} aria-hidden />
                    <Text fontSize="sm">Anyone with the link can view this snippet.</Text>
                  </HStack>
                  <label htmlFor={inputId}>
                    <Text fontSize="sm" fontWeight="medium" mb="1">
                      Share link
                    </Text>
                  </label>
                  <HStack>
                    <Input
                      id={inputId}
                      value={url}
                      readOnly
                      onFocus={(e) => e.target.select()}
                      fontFamily="mono"
                      fontSize="sm"
                    />
                    <CopyButton
                      text={url}
                      label="Copy link"
                      successMessage="Link copied"
                      colorPalette="teal"
                      flexShrink={0}
                    />
                  </HStack>
                  <Link
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    fontSize="sm"
                    colorPalette="teal"
                    alignSelf="flex-start"
                  >
                    Open in a new tab <ExternalLink size={14} aria-hidden />
                  </Link>
                </Stack>
              ) : (
                <Stack gap="3">
                  <HStack gap="2">
                    <Lock size={16} aria-hidden />
                    <Text fontSize="sm">This snippet is private. Only you can see it.</Text>
                  </HStack>
                  <Text fontSize="sm" color="fg.muted">
                    Make it public to get a link anyone can open. It will also appear on the Explore
                    page.
                  </Text>
                </Stack>
              )}
            </Dialog.Body>
            <Dialog.Footer>
              {isPublic ? (
                <Button
                  variant="outline"
                  onClick={() => onChangeVisibility('private')}
                  loading={pending}
                >
                  <Lock /> Make private
                </Button>
              ) : (
                <Button
                  colorPalette="teal"
                  onClick={() => onChangeVisibility('public')}
                  loading={pending}
                >
                  <Globe /> Make public
                </Button>
              )}
            </Dialog.Footer>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" aria-label="Close" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
