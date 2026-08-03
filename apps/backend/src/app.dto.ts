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
