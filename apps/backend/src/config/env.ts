import { z } from 'zod';
import { EnvSchema, type AppEnv } from './env.schema';

/**
 * Typed access to validated environment variables.
 * env.init() parses the source once at boot (fail-fast);
 * env.get('PORT') then returns the schema-typed value (number here).
 * Tests can build isolated instances: new EnvStore(fakeSource).
 */
export class EnvStore {
  private values: AppEnv | null = null;

  constructor(private readonly source: NodeJS.ProcessEnv = process.env) {}

  /** Parses and caches the environment. Call once at boot to fail fast. */
  init(): AppEnv {
    this.values = this.parse();
    return this.values;
  }

  /** Typed accessor; lazily initializes if init() was not called. */
  get<K extends keyof AppEnv>(key: K): AppEnv[K] {
    this.values ??= this.parse();
    return this.values[key];
  }

  private parse(): AppEnv {
    const result = EnvSchema.safeParse(this.withoutEmptyValues(this.source));
    if (!result.success) {
      throw new Error(
        `Invalid environment variables:\n${z.prettifyError(result.error)}`,
      );
    }
    return result.data;
  }

  /** dotenv keeps `KEY=` lines as empty strings; treat them as unset. */
  private withoutEmptyValues(
    source: NodeJS.ProcessEnv,
  ): Record<string, string> {
    return Object.fromEntries(
      Object.entries(source).filter((entry): entry is [string, string] =>
        Boolean(entry[1]),
      ),
    );
  }
}

/** App-wide singleton — unique thanks to Node's module evaluation. */
export const env = new EnvStore();
