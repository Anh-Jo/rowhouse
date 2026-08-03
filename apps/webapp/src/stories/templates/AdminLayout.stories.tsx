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
                <div style={{ padding: '2rem' }}>
                  <h2>Tableau de Bord</h2>
                  <p style={{ color: 'var(--color-text-secondary)' }}>Admin content placeholder</p>
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
