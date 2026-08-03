/**
 * Types for the multipart upload helper (`src/helpers/multipart.ts`).
 * Extracted per the repo convention (2+ types in a file). Named `upload`
 * rather than `multipart` on purpose: a `multipart.d.ts` next to
 * `multipart.ts` is treated by TS as that module's declaration companion,
 * which breaks a same-file `import` (TS2303 circular alias).
 */

/** A validated, fully-buffered single-file upload. */
export type ParsedUpload = {
  buffer: Buffer;
  mimetype: string;
  filename: string;
  /** Sibling text fields of the multipart body (validated by the caller). */
  fields: Record<string, unknown>;
};

export type ParseUploadOptions = {
  /** Reject (413) once the file exceeds this many bytes. */
  maxBytes: number;
  /** Accept only these MIME types (else 415). */
  allowedMimeTypes: readonly string[];
};
