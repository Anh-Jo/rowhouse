import {
  BadRequestException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { getMultipartField, parseSingleFileUpload } from './multipart';

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'] as const;
const OPTIONS = { maxBytes: 1000, allowedMimeTypes: ALLOWED };

/** Leading magic bytes for each supported image format. */
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const WEBP_MAGIC = Buffer.concat([
  Buffer.from('RIFF', 'ascii'),
  Buffer.from([0x1a, 0x00, 0x00, 0x00]),
  Buffer.from('WEBP', 'ascii'),
]);

/** Builds a fake FastifyRequest whose `.file()` yields the given part. */
function reqWithFile(
  part: {
    mimetype: string;
    filename?: string;
    fields?: Record<string, unknown>;
    toBuffer?: () => Promise<Buffer>;
  } | null,
): FastifyRequest {
  return {
    file: () =>
      Promise.resolve(
        part
          ? {
              mimetype: part.mimetype,
              filename: part.filename ?? 'avatar.jpg',
              fields: part.fields ?? {},
              toBuffer:
                part.toBuffer ??
                (() => Promise.resolve(Buffer.from(PNG_MAGIC))),
            }
          : undefined,
      ),
  } as unknown as FastifyRequest;
}

const tooLarge = Object.assign(new Error('too large'), {
  code: 'FST_REQ_FILE_TOO_LARGE',
});
const partsLimit = Object.assign(new Error('too many parts'), {
  code: 'FST_PARTS_LIMIT',
});
const fieldsLimit = Object.assign(new Error('too many fields'), {
  code: 'FST_FIELDS_LIMIT',
});

describe('parseSingleFileUpload', () => {
  it('returns the buffered file with its metadata on the happy path', async () => {
    const payload = Buffer.concat([PNG_MAGIC, Buffer.from('imgdata')]);
    const req = reqWithFile({
      mimetype: 'image/png',
      filename: 'me.png',
      fields: { caption: 'hi' },
      toBuffer: () => Promise.resolve(payload),
    });

    const result = await parseSingleFileUpload(req, OPTIONS);

    expect(result.mimetype).toBe('image/png');
    expect(result.filename).toBe('me.png');
    expect(result.buffer.equals(payload)).toBe(true);
    expect(result.fields).toEqual({ caption: 'hi' });
  });

  it('accepts a JPEG by its magic bytes', async () => {
    const req = reqWithFile({
      mimetype: 'image/jpeg',
      toBuffer: () => Promise.resolve(Buffer.from(JPEG_MAGIC)),
    });

    const result = await parseSingleFileUpload(req, OPTIONS);

    expect(result.mimetype).toBe('image/jpeg');
  });

  it('accepts a WEBP by its magic bytes', async () => {
    const req = reqWithFile({
      mimetype: 'image/webp',
      toBuffer: () => Promise.resolve(Buffer.from(WEBP_MAGIC)),
    });

    const result = await parseSingleFileUpload(req, OPTIONS);

    expect(result.mimetype).toBe('image/webp');
  });

  it('returns the sniffed type, not the spoofable declared header', async () => {
    // Declared PNG (passes the allow-list) but the bytes are actually a JPEG.
    const req = reqWithFile({
      mimetype: 'image/png',
      toBuffer: () => Promise.resolve(Buffer.from(JPEG_MAGIC)),
    });

    const result = await parseSingleFileUpload(req, OPTIONS);

    expect(result.mimetype).toBe('image/jpeg');
  });

  it('throws BadRequest when no file part is present', async () => {
    await expect(
      parseSingleFileUpload(reqWithFile(null), OPTIONS),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a disallowed declared mime type with 415 before buffering', async () => {
    const toBuffer = jest.fn(() => Promise.resolve(Buffer.from(PNG_MAGIC)));
    const req = reqWithFile({ mimetype: 'application/pdf', toBuffer });

    await expect(parseSingleFileUpload(req, OPTIONS)).rejects.toBeInstanceOf(
      UnsupportedMediaTypeException,
    );
    // Fail-fast: the buffer is never read for a disallowed declared type.
    expect(toBuffer).not.toHaveBeenCalled();
  });

  it('rejects an allowed declared header over non-image bytes with 415', async () => {
    const req = reqWithFile({
      mimetype: 'image/png',
      toBuffer: () => Promise.resolve(Buffer.from('<svg>not an image</svg>')),
    });

    await expect(parseSingleFileUpload(req, OPTIONS)).rejects.toBeInstanceOf(
      UnsupportedMediaTypeException,
    );
  });

  it('maps FST_REQ_FILE_TOO_LARGE from toBuffer to 413', async () => {
    const req = reqWithFile({
      mimetype: 'image/png',
      toBuffer: () => Promise.reject(tooLarge),
    });

    await expect(parseSingleFileUpload(req, OPTIONS)).rejects.toBeInstanceOf(
      PayloadTooLargeException,
    );
  });

  it('maps FST_REQ_FILE_TOO_LARGE from file() to 413', async () => {
    const req = {
      file: () => Promise.reject(tooLarge),
    } as unknown as FastifyRequest;

    await expect(parseSingleFileUpload(req, OPTIONS)).rejects.toBeInstanceOf(
      PayloadTooLargeException,
    );
  });

  it('maps FST_PARTS_LIMIT from file() to 413', async () => {
    const req = {
      file: () => Promise.reject(partsLimit),
    } as unknown as FastifyRequest;

    await expect(parseSingleFileUpload(req, OPTIONS)).rejects.toBeInstanceOf(
      PayloadTooLargeException,
    );
  });

  it('maps FST_FIELDS_LIMIT from file() to 400', async () => {
    const req = {
      file: () => Promise.reject(fieldsLimit),
    } as unknown as FastifyRequest;

    await expect(parseSingleFileUpload(req, OPTIONS)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rethrows unknown errors untouched', async () => {
    const boom = new Error('connection reset');
    const req = {
      file: () => Promise.reject(boom),
    } as unknown as FastifyRequest;

    await expect(parseSingleFileUpload(req, OPTIONS)).rejects.toBe(boom);
  });
});

describe('getMultipartField', () => {
  it('reads a string value from a text field part', () => {
    const fields = {
      title: { type: 'field', fieldname: 'title', value: 'hi' },
    };
    expect(getMultipartField(fields, 'title')).toBe('hi');
  });

  it('returns undefined for an absent field', () => {
    expect(getMultipartField({}, 'title')).toBeUndefined();
  });

  it('returns undefined for a file part (no string value)', () => {
    const fields = { photo: { type: 'file', filename: 'p.jpg' } };
    expect(getMultipartField(fields, 'photo')).toBeUndefined();
  });

  it('returns undefined when the value is not a string', () => {
    const fields = { n: { type: 'field', value: 42 } };
    expect(getMultipartField(fields, 'n')).toBeUndefined();
  });

  it('returns undefined for a repeated (array) field', () => {
    const fields = {
      tags: [
        { type: 'field', value: 'a' },
        { type: 'field', value: 'b' },
      ],
    };
    expect(getMultipartField(fields, 'tags')).toBeUndefined();
  });
});
