/** react-hook-form validators for the datasource connect form. */

function validateRequired(label: string) {
  return (value: string): string | true => {
    if (value.trim().length === 0) {
      return `${label} is required`;
    }
    if (value.trim().length > 200) {
      return `${label} must be at most 200 characters`;
    }
    return true;
  };
}

function validatePort(value: string): string | true {
  if (value.trim().length === 0) {
    return 'Port is required';
  }
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return 'Port must be an integer between 1 and 65535';
  }
  return true;
}

/**
 * The connection test's most important guardrail failure: the role configured
 * as read-only can actually write. It gets a prominent callout in the UI so
 * the wrong-grants (or swapped-credentials) case is impossible to miss.
 */
function isReadOnlyCanWriteProblem(problem: string): boolean {
  return /read.?only/i.test(problem) && /(write|insert|update|delete)/i.test(problem);
}

export { validateRequired, validatePort, isReadOnlyCanWriteProblem };
