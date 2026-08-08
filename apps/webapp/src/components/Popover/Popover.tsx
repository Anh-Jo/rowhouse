import type { ReactNode } from 'react';
import * as RadixPopover from '@radix-ui/react-popover';
import './Popover.css';

type PopoverProps = {
  trigger: ReactNode;
  children: ReactNode;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'right' | 'bottom' | 'left';
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
};

function Popover({ trigger, children, align = 'end', side = 'bottom', open, onOpenChange, className }: PopoverProps) {
  return (
    <RadixPopover.Root open={open} onOpenChange={onOpenChange}>
      <RadixPopover.Trigger asChild>{trigger}</RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content className={`popover__content${className ? ` ${className}` : ''}`} align={align} side={side} sideOffset={8}>
          {children}
          <RadixPopover.Arrow className="popover__arrow" />
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}

export { Popover };
/** Public component API — consumers type their props with this. @public */
export type { PopoverProps };
