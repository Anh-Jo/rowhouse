import {
  BadRequestException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
// Importing the plugin augments `FastifyRequest` with `.file()`.
import '@fastify/multipart';
import type { ParsedUpload, ParseUploadOptions } from './upload.d.ts';

/**
 * `@fastify/multipart` limit-breach error codes. Each maps to a 4xx instead of
 * bubbling as a 500: a file over the byte cap or too many parts is a payload
 * problem (413); too many text fields is a bad request (400).
 */
const FILE_TOO_LARGE_CODE = 'FST_REQ_FILE_TOO_LARGE';
const PARTS_LIMIT_CODE = 'FST_PARTS_LIMIT';
const FIELDS_LIMIT_CODE = 'FST_FIELDS_LIMIT';

/** Reads a string `code` off an unknown error, or `undefined`. */
function errorCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

/**
 * Maps a known `@fastify/multipart` limit error to the right HTTP exception,
 * or returns `null` to let the caller rethrow the original error.
 */
function toMultipartLimitException(
  error: unknown,
): PayloadTooLargeException | BadRequestException | null {
  switch (errorCode(error)) {
    case FILE_TOO_LARGE_CODE:
      return new PayloadTooLargeException('Uploaded file is too large');
    case PARTS_LIMIT_CODE:
      return new PayloadTooLargeException('Too many multipart parts');
    case FIELDS_LIMIT_CODE:
      return new BadRequestException('Too many multipart fields');
    default:
      return null;
  }
}

/**
 * Sniffs an image MIME type from a buffer's leading magic bytes, returning
 * `null` when the signature matches none of the supported image formats. Used
 * to assert the actual content type instead of trusting the client-declared
 * header (which is trivially spoofable). Covers `image/jpeg`, `image/png`,
 * `image/webp`.
 */
function sniffImageMimeType(buffer: Buffer): string | null {
  // JPEG: FF D8 FF
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return 'image/jpeg';
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }
  // WEBP: "RIFF" <4-byte size> "WEBP"
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

/**
 * Reads a single file part from a Fastify multipart request, enforcing a size
 * cap (→ 413) and a MIME allow-list (→ 415). The file is fully buffered in
 * memory (bounded by `maxBytes`). The global body pipe never sees multipart
 * bodies, so callers validate any text fields (`ParsedUpload.fields`)
 * themselves with Zod.
 *
 * The MIME type is checked twice: fail-fast on the client-declared header
 * *before* buffering, then on the buffer's actual magic bytes *after*
 * buffering. The returned `mimetype` is the sniffed (trusted) value, never
 * the declared header — a declared type is trivially spoofable.
 */
export async function parseSingleFileUpload(
  req: FastifyRequest,
  { maxBytes, allowedMimeTypes }: ParseUploadOptions,
): Promise<ParsedUpload> {
  let data;
  try {
    data = await req.file({ limits: { fileSize: maxBytes } });
  } catch (error) {
    const mapped = toMultipartLimitException(error);
    if (mapped) {
      throw mapped;
    }
    throw error;
  }

  if (!data) {
    throw new BadRequestException('A file is required');
  }

  // Fail-fast on the declared header before spending memory on the buffer.
  if (!allowedMimeTypes.includes(data.mimetype)) {
    throw new UnsupportedMediaTypeException(
      `Unsupported file type: ${data.mimetype}`,
    );
  }

  let buffer: Buffer;
  try {
    buffer = await data.toBuffer();
  } catch (error) {
    const mapped = toMultipartLimitException(error);
    if (mapped) {
      throw mapped;
    }
    throw error;
  }

  // Assert the actual content type from magic bytes — the declared header is
  // spoofable, so an allowed header over a non-image payload must still fail.
  const sniffedMimeType = sniffImageMimeType(buffer);
  if (sniffedMimeType === null || !allowedMimeTypes.includes(sniffedMimeType)) {
    throw new UnsupportedMediaTypeException(
      'Uploaded file content does not match an allowed image type',
    );
  }

  return {
    buffer,
    mimetype: sniffedMimeType,
    filename: data.filename,
    fields: data.fields,
  };
}

/**
 * Reads a single text field's string value out of the sibling fields of a
 * multipart body (`ParsedUpload.fields`). `@fastify/multipart` represents a
 * text part as `{ type: 'field', value, ... }`; this returns that `value` when
 * it is a string, and `undefined` when the field is absent, is the file part,
 * or repeats (array). Callers validate the extracted values with Zod.
 */
export function getMultipartField(
  fields: Record<string, unknown>,
  name: string,
): string | undefined {
  const field = fields[name];
  if (
    field !== null &&
    typeof field === 'object' &&
    'value' in field &&
    typeof (field as { value: unknown }).value === 'string'
  ) {
    return (field as { value: string }).value;
  }
  return undefined;
}
