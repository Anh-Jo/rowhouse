import type { ReactNode } from 'react';
import './SourceNote.css';

type SourceNoteProps = {
  children: ReactNode;
  /** `live` marks data still being consolidated, `final` a closed dataset. */
  status?: 'live' | 'final' | 'none';
  className?: string;
};

/**
 * Provenance line printed under a figure block. Every number in a data story
 * carries one — the dot signals whether the dataset is still moving.
 */
function SourceNote({ children, status = 'live', className }: SourceNoteProps) {
  return (
    <p className={`source-note source-note--${status}${className ? ` ${className}` : ''}`}>
      {status !== 'none' && <span className="source-note__dot" aria-hidden="true" />}
      <span>{children}</span>
    </p>
  );
}

export { SourceNote };
/** Public component API — consumers type their props with this. @public */
export type { SourceNoteProps };
