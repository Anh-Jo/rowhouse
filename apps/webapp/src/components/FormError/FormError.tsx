import { Callout } from '@/components/Callout/Callout';
import './FormError.css';

type FormErrorProps = {
  /** Message to surface; renders nothing when null. */
  message: string | null;
};

/** Inline API error banner for forms — accessible, never an alert(). */
function FormError({ message }: FormErrorProps) {
  if (!message) {
    return null;
  }
  return (
    <Callout variant="danger" role="alert" className="form-error">
      {message}
    </Callout>
  );
}

export { FormError };
/** Public component API — consumers type their props with this. @public */
export type { FormErrorProps };
