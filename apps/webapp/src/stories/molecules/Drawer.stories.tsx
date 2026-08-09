import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Search } from 'lucide-react';
import { Button } from '@/components/Button/Button';
import { Drawer } from '@/components/Drawer/Drawer';
import { Input } from '@/components/Input/Input';

/**
 * A side sheet with the modal semantics of a dialog. It exists for content the
 * user *browses* — a searchable, scrollable, paged list — next to the form it
 * feeds, instead of a dialog that hides the record being edited.
 */
const meta: Meta<typeof Drawer> = {
  title: 'Molecules/Drawer',
  component: Drawer,
};

export default meta;
type Story = StoryObj<typeof Drawer>;

const ROWS = [
  { identity: 'ada@example.test', key: 'id · 42' },
  { identity: 'grace@example.test', key: 'id · 43' },
  { identity: 'alan@example.test', key: 'id · 44' },
];

const ROW_STYLE = {
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  gap: '2px',
  padding: 'var(--space-2) var(--space-3)',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  background: 'transparent',
  textAlign: 'left',
  cursor: 'pointer',
} as const;

/** The shape the explorer's relation picker uses to select a foreign key. */
function PickerDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="secondary"
        icon={<Search size={14} />}
        onClick={() => setOpen(true)}
      >
        Change
      </Button>
      <Drawer
        open={open}
        onOpenChange={setOpen}
        title="Select a customers row"
        description="The value of customers.id is what gets written."
        footer={
          <Button variant="ghost" size="sm">
            Clear the relation (NULL)
          </Button>
        }
      >
        <Input
          placeholder="Search customers…"
          icon={<Search size={16} />}
          aria-label="Search customers"
        />
        <ul
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-1)',
            listStyle: 'none',
          }}
        >
          {ROWS.map((row) => (
            <li key={row.key}>
              <button type="button" style={ROW_STYLE}>
                <span style={{ fontSize: 'var(--font-size-13)' }}>
                  {row.identity}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--font-size-12)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  {row.key}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Drawer>
    </>
  );
}

export const PickARelatedRow: Story = {
  render: () => <PickerDemo />,
};
