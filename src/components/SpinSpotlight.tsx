import { useCallback, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft } from 'lucide-react';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

/** Move the same wheel into the spotlight: never remount its animation or audio. */
export function SpinSpotlight({ active, children }: { active: boolean; children: ReactNode }) {
  const [host] = useState(() => document.createElement('div'));
  const [dismissed, setDismissed] = useState(false);
  const inlineRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  if (!active && dismissed) setDismissed(false);

  useLayoutEffect(() => {
    inlineRef.current?.appendChild(host);
    return () => { host.remove(); };
  }, [host]);

  const returnWheel = useCallback(() => {
    const inline = inlineRef.current;
    if (!inline) return;
    inline.appendChild(host);
    inline.style.removeProperty('height');
  }, [host]);

  const mountSpotlight = useCallback((slot: HTMLDivElement | null) => {
    if (slot) {
      const inline = inlineRef.current;
      if (inline) inline.style.height = `${inline.getBoundingClientRect().height}px`;
      slot.appendChild(host);
    } else {
      returnWheel();
    }
  }, [host, returnWheel]);

  return (
    <>
      <div ref={inlineRef} className="w-full" />
      {createPortal(children, host)}
      <Dialog open={active && !dismissed} onOpenChange={(open) => {
        if (!open) {
          returnWheel();
          setDismissed(true);
        }
      }}>
        <DialogContent
          data-spin-spotlight=""
          showCloseButton={false}
          overlayClassName="bg-brand-ink/90"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          className="spin-spotlight max-h-[calc(100dvh-2rem)] gap-5 overflow-y-auto border-0 bg-transparent p-2 text-white shadow-none sm:max-w-[40rem] sm:p-4"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            titleRef.current?.focus({ preventScroll: true });
          }}
          onCloseAutoFocus={(event) => {
            // The result owns focus at completion. Only return it on explicit dismissal.
            event.preventDefault();
            if (active) openerRef.current?.focus({ preventScroll: true });
          }}
        >
          <div className="text-center">
            <DialogTitle ref={titleRef} id={titleId} tabIndex={-1} className="text-3xl font-bold outline-none sm:text-4xl">
              Let fate decide.
            </DialogTitle>
            <DialogDescription id={descriptionId} className="mt-2 text-base text-white">
              Spinning… your next meal is on its way.
            </DialogDescription>
          </div>
          <div ref={mountSpotlight} className="spin-spotlight-wheel w-full" />
          <button type="button" onClick={() => {
            returnWheel();
            setDismissed(true);
          }} className="mx-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-full border-2 border-white/60 px-5 text-sm font-semibold text-white hover:bg-white/10 focus-visible:outline-white">
            <ArrowLeft size={16} aria-hidden="true" />
            Back to app
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}
