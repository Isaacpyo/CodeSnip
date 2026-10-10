import { useCallback, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { COLOR_MODE_STORAGE_KEY, ColorModeContext, type ColorMode } from './colorMode';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function systemMode(): ColorMode {
  return window.matchMedia?.(DARK_QUERY).matches ? 'dark' : 'light';
}

function storedMode(): ColorMode | null {
  try {
    const value = localStorage.getItem(COLOR_MODE_STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

/**
 * Light/dark mode: follows the OS until the user picks one, then remembers it.
 * Chakra's `_dark` styles key off the `dark` class on <html>.
 */
export function ColorModeProvider({ children }: { children: ReactNode }) {
  const [chosen, setChosen] = useState<ColorMode | null>(storedMode);
  const [system, setSystem] = useState<ColorMode>(systemMode);
  const colorMode = chosen ?? system;

  useEffect(() => {
    const query = window.matchMedia?.(DARK_QUERY);
    if (!query) return;
    const onChange = () => setSystem(query.matches ? 'dark' : 'light');
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', colorMode === 'dark');
    root.classList.toggle('light', colorMode === 'light');
    root.style.colorScheme = colorMode;
  }, [colorMode]);

  const setColorMode = useCallback((mode: ColorMode) => {
    setChosen(mode);
    try {
      localStorage.setItem(COLOR_MODE_STORAGE_KEY, mode);
    } catch {
      // storage unavailable: the choice lasts for this session only
    }
  }, []);

  const value = useMemo(() => ({ colorMode, setColorMode }), [colorMode, setColorMode]);
  return <ColorModeContext.Provider value={value}>{children}</ColorModeContext.Provider>;
}
