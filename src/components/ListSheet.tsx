import { useState, type ComponentProps, type CSSProperties, type ReactNode } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export function ListSheet({ title, description, children, onClose, focusTarget, className, style, onOpenAutoFocus }: {
  title: string;
  description: string;
  children: ReactNode;
  onClose: () => void;
  focusTarget?: HTMLElement | null;
  className?: string;
  style?: CSSProperties;
  onOpenAutoFocus?: ComponentProps<typeof DialogContent>['onOpenAutoFocus'];
}) {
  const [trigger] = useState(() => document.activeElement instanceof HTMLElement ? document.activeElement : null);
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent style={style} onOpenAutoFocus={onOpenAutoFocus} onCloseAutoFocus={event => {
      event.preventDefault();
      if (!document.querySelector('[role="dialog"], [role="alertdialog"]')) (focusTarget ?? trigger)?.focus();
    }} showCloseButton={false} className={cn('left-0 top-auto bottom-0 max-h-[90dvh] max-w-full translate-x-0 translate-y-0 overflow-y-auto rounded-b-none rounded-t-[28px] bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] font-heading text-brand-ink sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[28px]', className)}>
      <div aria-hidden="true" className="mx-auto h-1.5 w-12 rounded-full bg-brand-ink/40 sm:hidden" />
      <DialogTitle className="text-2xl font-bold">{title}</DialogTitle>
      <DialogDescription className="text-base text-brand-ink/80">{description}</DialogDescription>
      {children}
    </DialogContent>
  </Dialog>;
}
