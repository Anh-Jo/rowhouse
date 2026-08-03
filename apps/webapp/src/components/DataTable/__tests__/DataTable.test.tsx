import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataTable } from '../DataTable';
import type { Column } from '../DataTable';

type TestRow = {
  id: string;
  name: string;
  value: number;
};

const testData: TestRow[] = [
  { id: '1', name: 'Alice', value: 100 },
  { id: '2', name: 'Bob', value: 200 },
  { id: '3', name: 'Charlie', value: 50 },
];

const columns: Column<TestRow>[] = [
  { key: 'name', header: 'Name', render: (r) => r.name, sortable: true },
  { key: 'value', header: 'Value', render: (r) => String(r.value), sortable: true, sortValue: (r) => r.value },
];

describe('DataTable', () => {
  it('renders column headers', () => {
    render(<DataTable columns={columns} data={testData} keyExtractor={(r) => r.id} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Value')).toBeInTheDocument();
  });

  it('renders all rows', () => {
    render(<DataTable columns={columns} data={testData} keyExtractor={(r) => r.id} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
  });

  it('displays empty message when no data', () => {
    render(<DataTable columns={columns} data={[]} keyExtractor={(r) => r.id} emptyMessage="No data" />);
    expect(screen.getByText('No data')).toBeInTheDocument();
  });

  it('calls onRowClick when a row is clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<DataTable columns={columns} data={testData} keyExtractor={(r) => r.id} onRowClick={onClick} />);
    await user.click(screen.getByText('Alice'));
    expect(onClick).toHaveBeenCalledWith(testData[0]);
  });

  it('renders action buttons', () => {
    render(
      <DataTable
        columns={columns}
        data={testData}
        keyExtractor={(r) => r.id}
        actions={(r) => <button>Edit {r.name}</button>}
      />,
    );
    expect(screen.getByText('Edit Alice')).toBeInTheDocument();
    expect(screen.getByText('Edit Bob')).toBeInTheDocument();
  });

  it('renders Actions header when actions provided', () => {
    render(
      <DataTable
        columns={columns}
        data={testData}
        keyExtractor={(r) => r.id}
        actions={() => <button>Act</button>}
      />,
    );
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('sorts data ascending when sortable header is clicked', async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} data={testData} keyExtractor={(r) => r.id} />);

    const valueHeader = screen.getByText('Value').closest('th')!;
    await user.click(valueHeader);

    const rows = screen.getAllByRole('row');
    // rows[0] is header, rows[1..3] are data rows
    const cellValues = rows.slice(1).map((row) => row.querySelectorAll('td')[1].textContent);
    expect(cellValues).toEqual(['50', '100', '200']);
  });

  it('sorts data descending on second click', async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} data={testData} keyExtractor={(r) => r.id} />);

    const valueHeader = screen.getByText('Value').closest('th')!;
    await user.click(valueHeader); // asc
    await user.click(valueHeader); // desc

    const rows = screen.getAllByRole('row');
    const cellValues = rows.slice(1).map((row) => row.querySelectorAll('td')[1].textContent);
    expect(cellValues).toEqual(['200', '100', '50']);
  });

  it('resets sort on third click', async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} data={testData} keyExtractor={(r) => r.id} />);

    const valueHeader = screen.getByText('Value').closest('th')!;
    await user.click(valueHeader); // asc
    await user.click(valueHeader); // desc
    await user.click(valueHeader); // reset

    const rows = screen.getAllByRole('row');
    const cellValues = rows.slice(1).map((row) => row.querySelectorAll('td')[1].textContent);
    // Original order
    expect(cellValues).toEqual(['100', '200', '50']);
  });
});
