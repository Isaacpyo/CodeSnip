import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ColorModeButton } from '../components/ColorModeButton';
import { ChakraProvider } from '@chakra-ui/react';
import { COLOR_MODE_STORAGE_KEY } from './colorMode';
import { ColorModeProvider } from './ColorModeProvider';
import { system } from './system';

const renderToggle = () =>
  render(
    <ChakraProvider value={system}>
      <ColorModeProvider>
        <ColorModeButton />
      </ColorModeProvider>
    </ChakraProvider>,
  );

describe('ColorModeProvider', () => {
  it('follows the system preference until the user chooses, then remembers the choice', async () => {
    const user = userEvent.setup();
    renderToggle();
    expect(document.documentElement).toHaveClass('light');
    await user.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
    expect(document.documentElement).toHaveClass('dark');
    expect(document.documentElement).not.toHaveClass('light');
    expect(localStorage.getItem(COLOR_MODE_STORAGE_KEY)).toBe('dark');
  });

  it('restores a saved choice', () => {
    localStorage.setItem(COLOR_MODE_STORAGE_KEY, 'dark');
    act(() => void renderToggle());
    expect(screen.getByRole('button', { name: 'Switch to light mode' })).toBeInTheDocument();
  });
});
