import { createContext, useContext } from 'react';

export type ColorMode = 'light' | 'dark';
export const COLOR_MODE_STORAGE_KEY = 'codesnip:color-mode';

export interface ColorModeContextValue {
  colorMode: ColorMode;
  setColorMode: (mode: ColorMode) => void;
}

export const ColorModeContext = createContext<ColorModeContextValue>({
  colorMode: 'light',
  setColorMode: () => {},
});

export function useColorMode(): ColorModeContextValue {
  return useContext(ColorModeContext);
}
