import type { ReactNode } from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import './Drawer.css';

type DrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** Pinned under the scrolling body — actions that must stay reachable. */
  footer?: ReactNode;
  className?: string;
};

/**
 * A side sheet: same modal semantics as `Dialog` (focus trap, Escape, click
 * outside) but anchored to the right edge and full height, so it can hold a
 * list the user browses — searching, scrolling, paging — without losing the
 * screen underneath. Full width on mobile, where a side panel would be a
 * cramped dialog.
 */
function Drawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: DrawerProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="drawer__overlay" />
        <RadixDialog.Content
          className={`drawer__content${className ? ` ${className}` : ''}`}
          // The body owns a search box; letting Radix focus it on open would
          // scroll-jump on mobile keyboards — the panel takes focus instead.
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <div className="drawer__header">
            <RadixDialog.Title className="drawer__title">
              {title}
            </RadixDialog.Title>
            {description && (
              <RadixDialog.Description className="drawer__description">
                {description}
              </RadixDialog.Description>
            )}
            <RadixDialog.Close asChild>
              <button className="drawer__close" aria-label="Close">
                <X size={18} />
              </button>
            </RadixDialog.Close>
          </div>
          <div className="drawer__body">{children}</div>
          {footer && <div className="drawer__footer">{footer}</div>}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

export { Drawer };
/** Public component API — consumers type their props with this. @public */
export type { DrawerProps };
