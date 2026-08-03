import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/Button/Button';
import { FormError } from '@/components/FormError/FormError';
import { Input } from '@/components/Input/Input';
import { authClient } from '@/api/auth-client';
import { validateEmail, validatePassword } from '../helpers/validation';
import { AuthCard } from './AuthCard';

type SignInFormValues = {
  email: string;
  password: string;
};

function SignInPage() {
  const navigate = useNavigate();
  const [apiError, setApiError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInFormValues>();

  const onSubmit = async (values: SignInFormValues) => {
    setApiError(null);
    const { error } = await authClient.signIn.email({
      email: values.email.trim(),
      password: values.password,
    });
    if (error) {
      setApiError(error.message ?? 'Sign-in failed, please try again.');
      return;
    }
    navigate('/', { replace: true });
  };

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to your Rowhouse account"
      footer={
        <span>
          No account yet? <Link to="/sign-up">Create one</Link>
        </span>
      }
    >
      <form
        className="auth-form"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
      >
        <FormError message={apiError} />
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email', { validate: validateEmail })}
        />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password', { validate: validatePassword })}
        />
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthCard>
  );
}

export { SignInPage };
