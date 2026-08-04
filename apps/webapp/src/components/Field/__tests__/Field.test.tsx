import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Field } from '../Field';

describe('Field', () => {
  it('associates the label with the control via htmlFor', () => {
    render(
      <Field label="Host" htmlFor="host">
        <input id="host" />
      </Field>,
    );
    expect(screen.getByLabelText('Host')).toBeInTheDocument();
  });

  it('shows the hint when there is no error', () => {
    render(
      <Field label="Port" hint="Default is 5432">
        <input />
      </Field>,
    );
    expect(screen.getByText('Default is 5432')).toBeInTheDocument();
  });

  it('replaces the hint with the error and exposes the error id', () => {
    render(
      <Field label="Port" hint="Default is 5432" error="Port is required" errorId="port-error">
        <input />
      </Field>,
    );
    expect(screen.queryByText('Default is 5432')).not.toBeInTheDocument();
    expect(screen.getByText('Port is required')).toHaveAttribute('id', 'port-error');
  });
});
