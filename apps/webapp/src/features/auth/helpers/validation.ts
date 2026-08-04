/**
 * Pure validation rules for the auth forms, shaped for react-hook-form's
 * `validate` option: return `true` when valid, an error message otherwise.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Mirrors better-auth's default minimum password length. */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const NAME_MAX_LENGTH = 100;

export function validateEmail(value: string): string | true {
  if (value.trim().length === 0) {
    return 'Email is required';
  }
  if (!EMAIL_PATTERN.test(value.trim())) {
    return 'Enter a valid email address';
  }
  return true;
}

export function validatePassword(value: string): string | true {
  if (value.length === 0) {
    return 'Password is required';
  }
  if (value.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  }
  if (value.length > PASSWORD_MAX_LENGTH) {
    return `Password must be at most ${PASSWORD_MAX_LENGTH} characters`;
  }
  return true;
}

export function validateName(value: string): string | true {
  if (value.trim().length === 0) {
    return 'Name is required';
  }
  if (value.trim().length > NAME_MAX_LENGTH) {
    return `Name must be at most ${NAME_MAX_LENGTH} characters`;
  }
  return true;
}
