import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Reference DTO pattern: a Zod schema wrapped by createZodDto.
 * The schema drives runtime validation (global ZodValidationPipe),
 * the TypeScript type, and the OpenAPI documentation.
 */
const HelloResponseSchema = z.object({
  message: z.string().describe('Greeting message'),
});

export class HelloResponseDto extends createZodDto(HelloResponseSchema) {}

/** The authenticated caller's app profile (mirror of the better-auth user). */
const MeResponseSchema = z.object({
  id: z.string().describe('User id (same as the better-auth user id)'),
  displayName: z.string().describe('Display name (defaults to sign-up name)'),
});

export class MeResponseDto extends createZodDto(MeResponseSchema) {}
