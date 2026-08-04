import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import './CodeBlock.css';

type CodeBlockProps = {
  code: string;
  /** Quiet uppercase label in the block header (e.g. "SQL"). */
  label?: string;
  /** Show the copy button (needs a clipboard-capable context). */
  copyable?: boolean;
  className?: string;
};

/** Mono code well for SQL snippets, ids and config — scrolls, never wraps. */
function CodeBlock({ code, label, copyable = true, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={`code-block${className ? ` ${className}` : ''}`}>
      {(label || copyable) && (
        <div className="code-block__header">
          <span className="code-block__label">{label}</span>
          {copyable && (
            <button
              type="button"
              className="code-block__copy"
              onClick={onCopy}
              aria-label={copied ? 'Copied' : 'Copy code'}
            >
              {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          )}
        </div>
      )}
      <pre className="code-block__pre">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export { CodeBlock };
/** Public component API — consumers type their props with this. @public */
export type { CodeBlockProps };
