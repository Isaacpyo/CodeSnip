import { IconButton } from '@chakra-ui/react';
import { Moon, Sun } from 'lucide-react';
import { useColorMode } from '../ui/colorMode';

export function ColorModeButton() {
  const { colorMode, setColorMode } = useColorMode();
  const dark = colorMode === 'dark';
  return (
    <IconButton
      variant="ghost"
      size="sm"
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
      onClick={() => setColorMode(dark ? 'light' : 'dark')}
    >
      {dark ? <Sun /> : <Moon />}
    </IconButton>
  );
}
