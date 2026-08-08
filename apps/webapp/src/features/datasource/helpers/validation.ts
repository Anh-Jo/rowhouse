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

/** Mirrors the backend's Cloud SQL instance connection name schema. */
const INSTANCE_CONNECTION_NAME_PATTERN =
  /^[a-z][-a-z0-9]*:[a-z0-9-]+:[a-z][-a-z0-9]*$/;

function validateInstanceConnectionName(value: string): string | true {
  if (value.trim().length === 0) {
    return 'Instance connection name is required';
  }
  if (!INSTANCE_CONNECTION_NAME_PATTERN.test(value.trim())) {
    return 'Must be "project:region:instance" — the Cloud SQL instance connection name';
  }
  return true;
}

/**
 * The key is write-only server-side (sealed on save), so after registration a
 * blank field means "keep the stored key" — required only on first save.
 */
function validateSaKeyJson(required: boolean) {
  return (value: string): string | true => {
    if (value.trim().length === 0) {
      return required ? 'Service account key is required' : true;
    }
    try {
      JSON.parse(value);
      return true;
    } catch {
      return 'Must be the JSON content of a service-account key file';
    }
  };
}

/**
 * The connection test's most important guardrail failure: the role configured
 * as read-only can actually write. It gets a prominent callout in the UI so
 * the wrong-grants (or swapped-credentials) case is impossible to miss.
 */
function isReadOnlyCanWriteProblem(problem: string): boolean {
  return /read.?only/i.test(problem) && /(write|insert|update|delete)/i.test(problem);
}

export {
  validateRequired,
  validatePort,
  validateInstanceConnectionName,
  validateSaKeyJson,
  isReadOnlyCanWriteProblem,
};
