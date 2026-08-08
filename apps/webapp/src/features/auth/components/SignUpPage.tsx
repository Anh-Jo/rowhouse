import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/Button/Button';
import { FormError } from '@/components/FormError/FormError';
import { Input } from '@/components/Input/Input';
import { authClient } from '@/api/auth-client';
import {
  validateEmail,
  validateName,
  validatePassword,
} from '../helpers/validation';
import { AuthCard } from './AuthCard';

type SignUpFormValues = {
  name: string;
  email: string;
  password: string;
};

function SignUpPage() {
  const navigate = useNavigate();
  const [apiError, setApiError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpFormValues>();

  const onSubmit = async (values: SignUpFormValues) => {
    setApiError(null);
    const { error } = await authClient.signUp.email({
      name: values.name.trim(),
      email: values.email.trim(),
      password: values.password,
    });
    if (error) {
      setApiError(error.message ?? 'Sign-up failed, please try again.');
      return;
    }
    // A fresh account has no workspace yet — go straight to onboarding.
    navigate('/onboarding', { replace: true });
  };

  return (
    <AuthCard
      title="Create your account"
      subtitle="A governed workspace for your databases"
      footer={
        <span>
          Already have an account? <Link to="/sign-in">Sign in</Link>
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
          label="Name"
          type="text"
          autoComplete="name"
          error={errors.name?.message}
          {...register('name', { validate: validateName })}
        />
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
          autoComplete="new-password"
          error={errors.password?.message}
          {...register('password', { validate: validatePassword })}
        />
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthCard>
  );
}

export { SignUpPage };
