import type { Meta, StoryObj } from '@storybook/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AdminLayout } from '@/layouts/AdminLayout/AdminLayout';

const meta: Meta<typeof AdminLayout> = {
  title: 'Templates/AdminLayout',
  component: AdminLayout,
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={<Story />}>
            <Route
              index
              element={
                <div style={{ padding: 'var(--space-8)' }}>
                  <h2>Datasources</h2>
                  <p style={{ color: 'var(--color-text-secondary)' }}>App shell placeholder content</p>
                </div>
              }
            />
          </Route>
        </Routes>
      </MemoryRouter>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof AdminLayout>;

export const Default: Story = {};
