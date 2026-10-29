import { useCallback, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';

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
          overlayClassName="bg-brand-ink/95"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          className="spin-spotlight max-h-[calc(100dvh-2rem)] gap-6 overflow-y-auto border-0 bg-transparent p-2 text-white shadow-none sm:max-w-[40rem] sm:p-4"
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
          <div className="spin-spotlight-heading text-center">
            <div aria-hidden="true" className="mb-3 flex items-center justify-center gap-3 text-arcade-pink">
              <span className="h-0.5 w-8 rounded-full bg-current" />
              <Sparkles size={22} strokeWidth={2.5} />
              <span className="h-0.5 w-8 rounded-full bg-current" />
            </div>
            <DialogTitle ref={titleRef} id={titleId} tabIndex={-1} className="text-[clamp(2rem,6vw,3rem)] font-bold leading-[1.1] tracking-tight text-arcade-yellow outline-none">
              Let fate decide.
            </DialogTitle>
            <DialogDescription id={descriptionId} className="mx-auto mt-3 max-w-[28ch] text-base leading-relaxed text-brand-linen">
              Spinning… your next meal is on its way.
            </DialogDescription>
          </div>
          <div ref={mountSpotlight} className="spin-spotlight-wheel w-full" />
          <button type="button" onClick={() => {
            returnWheel();
            setDismissed(true);
          }} className="spin-spotlight-back mx-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-[3px] border-brand-ink bg-brand-linen px-6 text-base font-semibold text-brand-ink transition-colors hover:bg-arcade-yellow active:bg-arcade-pink focus-visible:outline-white">
            <ArrowLeft size={16} aria-hidden="true" />
            Back to app
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}
