import type { z } from 'zod';
import type { EnvSchema } from './src/config/env.schema';

/**
 * Raw (pre-validation) environment keys, derived from the Zod schema.
 * Everything is an optional string here: values are only typed and guaranteed
 * after parsing through env.init() / env.get() (see src/config/env.ts).
 */
type AppEnvInput = z.input<typeof EnvSchema>;

declare global {
  namespace NodeJS {
    interface ProcessEnv extends Partial<Record<keyof AppEnvInput, string>> {
      [key: string]: string | undefined;
    }
  }
}

export {};
