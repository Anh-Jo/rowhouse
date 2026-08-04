import type { ReactNode } from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import './Dialog.css';

type DialogProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

function Dialog({ open, onOpenChange, trigger, title, description, children, className }: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger>}
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="dialog__overlay" />
        <RadixDialog.Content className={`dialog__content${className ? ` ${className}` : ''}`}>
          <div className="dialog__header">
            <RadixDialog.Title className="dialog__title">{title}</RadixDialog.Title>
            {description && <RadixDialog.Description className="dialog__description">{description}</RadixDialog.Description>}
            <RadixDialog.Close asChild>
              <button className="dialog__close" aria-label="Close">
                <X size={18} />
              </button>
            </RadixDialog.Close>
          </div>
          <div className="dialog__body">{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

export { Dialog };
/** Public component API — consumers type their props with this. @public */
export type { DialogProps };
