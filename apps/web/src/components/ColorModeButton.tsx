import { ClientOnly, IconButton, Skeleton } from '@chakra-ui/react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

export function ColorModeButton() {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  return (
    <ClientOnly fallback={<Skeleton boxSize="8" />}>
      <IconButton
        variant="ghost"
        size="sm"
        aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        title={dark ? 'Light mode' : 'Dark mode'}
        onClick={() => setTheme(dark ? 'light' : 'dark')}
      >
        {dark ? <Sun /> : <Moon />}
      </IconButton>
    </ClientOnly>
  );
}
