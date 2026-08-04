import React, { useEffect } from 'react';
import type { Preview } from '@storybook/react';
import '../src/styles/reset.css';
import '../src/styles/tokens.css';
import '../src/styles/global.css';

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Color theme',
      toolbar: {
        title: 'Theme',
        icon: 'mirror',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: 'light',
  },
  decorators: [
    (Story, context) => {
      const theme = (context.globals.theme as string) ?? 'light';
      // Stamp the app's theming attribute — the same mechanism the product
      // uses (tokens.css switches on [data-theme]).
      useEffect(() => {
        document.documentElement.dataset.theme = theme;
      }, [theme]);
      return <Story />;
    },
  ],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    // The canvas ground comes from the real tokens (body uses --color-bg),
    // so Storybook's own background switcher would fight the theme toggle.
    backgrounds: { disable: true },
    options: {
      storySort: {
        order: [
          'Foundations',
          ['Principles', 'Colors', 'Typography', 'Spacing & Radius', 'Motion'],
          'Atoms',
          'Molecules',
          'Organisms',
          'Templates',
          'Recipes',
        ],
      },
    },
  },
};

export default preview;
