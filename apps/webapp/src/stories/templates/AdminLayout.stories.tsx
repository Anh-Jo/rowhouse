import type { Meta, StoryObj } from '@storybook/react';
import type { ReactNode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { AdminLayout } from '@/layouts/AdminLayout/AdminLayout';
import { FULL_BLEED } from '@/layouts/AdminLayout/route-handle';

// A data router (not MemoryRouter) — the layout resolves its content mode
// from route handles via useMatches, which only data routers provide.
function shellWith(children: ReactNode, handle?: object) {
  const router = createMemoryRouter(
    [
      {
        path: '/admin',
        element: <AdminLayout />,
        children: [{ index: true, element: children, handle }],
      },
    ],
    { initialEntries: ['/admin'] },
  );
  return <RouterProvider router={router} />;
}

const meta: Meta<typeof AdminLayout> = {
  title: 'Templates/AdminLayout',
  component: AdminLayout,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof AdminLayout>;

export const Default: Story = {
  render: () =>
    shellWith(
      <div>
        <h2>Datasources</h2>
        <p style={{ color: 'var(--color-text-secondary)' }}>
          App shell placeholder content — readable mode, padded column.
        </p>
      </div>,
    ),
};

/** Data views opt in via `handle: FULL_BLEED`: no shell padding, whole
    viewport, the page owns its scrolling. */
export const FullBleed: Story = {
  render: () =>
    shellWith(
      <div
        style={{
          flex: 1,
          display: 'grid',
          placeItems: 'center',
          background:
            'repeating-linear-gradient(45deg, var(--color-surface-sunken), var(--color-surface-sunken) 12px, var(--color-surface) 12px, var(--color-surface) 24px)',
        }}
      >
        <p style={{ color: 'var(--color-text-secondary)' }}>
          Full-bleed content area — edge to edge.
        </p>
      </div>,
      FULL_BLEED,
    ),
};
