import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CodeBlock } from '../CodeBlock';

const SQL = 'CREATE ROLE rowhouse_ro;';

describe('CodeBlock', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the code and label', () => {
    render(<CodeBlock code={SQL} label="SQL" copyable={false} />);
    expect(screen.getByText(SQL)).toBeInTheDocument();
    expect(screen.getByText('SQL')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('copies the code to the clipboard', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    render(<CodeBlock code={SQL} label="SQL" />);
    await user.click(screen.getByRole('button', { name: 'Copy code' }));

    expect(writeText).toHaveBeenCalledWith(SQL);
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });
});
