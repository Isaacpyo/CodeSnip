import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react';

const config = defineConfig({
  globalCss: {
    'html, body': { minHeight: '100%' },
    body: { bg: 'bg', color: 'fg' },
  },
  theme: {
    tokens: {
      fonts: {
        heading: {
          value:
            "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        },
        body: {
          value:
            "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        },
        mono: {
          value: "ui-monospace, 'SFMono-Regular', 'JetBrains Mono', Menlo, Consolas, monospace",
        },
      },
    },
  },
});

export const system = createSystem(defaultConfig, config);
