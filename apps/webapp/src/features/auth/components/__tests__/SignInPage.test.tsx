import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SignInPage } from '../SignInPage';

type SignInInput = { email: string; password: string };
type SignInResult = {
  data: Record<string, unknown> | null;
  error: { message?: string; status: number } | null;
};

const { signInEmail } = vi.hoisted(() => ({
  signInEmail: vi.fn<(input: SignInInput) => Promise<SignInResult>>(),
}));

vi.mock('@/api/auth-client', () => ({
  authClient: {
    signIn: {
      email: signInEmail,
    },
  },
}));

function renderSignIn() {
  return render(
    <MemoryRouter initialEntries={['/sign-in']}>
      <Routes>
        <Route path="/sign-in" element={<SignInPage />} />
        <Route path="/" element={<div>home</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SignInPage', () => {
  beforeEach(() => {
    signInEmail.mockReset();
  });

  it('shows validation errors and does not call the API on an empty submit', async () => {
    const user = userEvent.setup();
    renderSignIn();

    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(signInEmail).not.toHaveBeenCalled();
  });

  it('rejects a malformed email before hitting the API', async () => {
    const user = userEvent.setup();
    renderSignIn();

    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(
      await screen.findByText('Enter a valid email address'),
    ).toBeInTheDocument();
    expect(signInEmail).not.toHaveBeenCalled();
  });

  it('surfaces the API error inline', async () => {
    signInEmail.mockResolvedValue({
      data: null,
      error: { message: 'Invalid email or password', status: 401 },
    });
    const user = userEvent.setup();
    renderSignIn();

    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Invalid email or password');
  });

  it('navigates home on success', async () => {
    signInEmail.mockResolvedValue({ data: {}, error: null });
    const user = userEvent.setup();
    renderSignIn();

    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('home')).toBeInTheDocument();
    expect(signInEmail).toHaveBeenCalledWith({
      email: 'ada@example.com',
      password: 'password123',
    });
  });
});
