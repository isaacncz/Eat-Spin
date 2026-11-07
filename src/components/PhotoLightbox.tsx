import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { toViewerPhotoUrl } from '@/lib/photoUrls';
import { cn } from '@/lib/utils';

interface PhotoLightboxProps {
  photos: string[];
  /** Photo shown when the viewer opens. */
  startIndex: number;
  alt: string;
  onClose: () => void;
  /** Called when the viewer has closed, to put focus back on the photo that opened it. */
  onReturnFocus: () => void;
}

const SWIPE_DISTANCE_PX = 50;
const navButton =
  'absolute top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border-2 border-brand-ink bg-white text-brand-ink shadow-pop outline-none transition-all hover:bg-arcade-yellow focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-ink active:shadow-none';

/**
 * Full-screen photo viewer. Mount it only while open: it creates no image request until then.
 * Exactly one image element exists at a time, for the photo on screen; neighbours are never
 * prefetched, so another photo is requested only after an explicit button, key or swipe.
 */
export function PhotoLightbox({ photos, startIndex, alt, onClose, onReturnFocus }: PhotoLightboxProps) {
  const [index, setIndex] = useState(() => Math.min(Math.max(startIndex, 0), photos.length - 1));
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const count = photos.length;
  const canNavigate = count > 1;

  const go = (step: number) => setIndex((current) => (current + step + count) % count);

  const onKeyDown = (event: KeyboardEvent) => {
    if (!canNavigate) return;
    if (event.key === 'ArrowLeft') { event.preventDefault(); go(-1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); go(1); }
  };
  // Only the first finger can start a swipe, so a second finger (pinch) never counts as one.
  const onPointerDown = (event: PointerEvent) => {
    if (event.isPrimary) swipeStart.current = { x: event.clientX, y: event.clientY };
  };
  const onPointerUp = (event: PointerEvent) => {
    if (!event.isPrimary) return;
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start || !canNavigate) return;
    const dx = event.clientX - start.x;
    if (Math.abs(dx) >= SWIPE_DISTANCE_PX && Math.abs(dx) > Math.abs(event.clientY - start.y)) go(dx < 0 ? 1 : -1);
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        data-testid="photo-lightbox"
        showCloseButton={false}
        overlayClassName="bg-brand-ink"
        onKeyDown={onKeyDown}
        onCloseAutoFocus={(event) => { event.preventDefault(); onReturnFocus(); }}
        className="left-0 top-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 bg-brand-ink p-0 text-white shadow-none sm:max-w-none"
      >
        <DialogTitle className="sr-only">{alt}</DialogTitle>
        <DialogDescription className="sr-only">
          {canNavigate ? 'Use the arrow buttons, arrow keys or swipe to change photo.' : 'Photo viewer.'}
        </DialogDescription>

        <div className="flex min-h-14 items-center pl-4 pr-16 pt-[env(safe-area-inset-top)]">
          <p aria-live="polite" className="rounded-md bg-black/50 px-2 py-1 text-sm font-semibold">
            Photo {index + 1} of {count}
          </p>
        </div>
        <DialogClose
          aria-label="Close photo viewer"
          className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-10 flex size-11 items-center justify-center rounded-full border-2 border-brand-ink bg-white text-brand-ink shadow-pop outline-none transition-all hover:bg-arcade-yellow focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-ink active:shadow-none"
        >
          <X size={20} aria-hidden="true" />
        </DialogClose>

        <div
          className="relative min-h-0 flex-1 [touch-action:pan-y_pinch-zoom]"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => { swipeStart.current = null; }}
        >
          <LightboxImage key={photos[index]} src={photos[index]} alt={`${alt} — photo ${index + 1}`} />
          {canNavigate && (
            <>
              <button type="button" aria-label="Previous photo" onClick={() => go(-1)} className={cn(navButton, 'left-[max(0.75rem,env(safe-area-inset-left))]')}>
                <ChevronLeft size={22} aria-hidden="true" />
              </button>
              <button type="button" aria-label="Next photo" onClick={() => go(1)} className={cn(navButton, 'right-[max(0.75rem,env(safe-area-inset-right))]')}>
                <ChevronRight size={22} aria-hidden="true" />
              </button>
            </>
          )}
        </div>
        <div className="h-[max(1rem,env(safe-area-inset-bottom))]" aria-hidden="true" />
      </DialogContent>
    </Dialog>
  );
}

/** One image: the larger variant, falling back to the card-size URL if that request fails. */
function LightboxImage({ src, alt }: { src: string; alt: string }) {
  const largeSrc = toViewerPhotoUrl(src);
  const [currentSrc, setCurrentSrc] = useState(largeSrc);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <div className="flex h-full w-full items-center justify-center">
      {!loaded && !failed && <p role="status" className="absolute text-sm font-semibold text-white/80">Loading photo…</p>}
      {failed ? (
        <p role="alert" className="px-6 text-center text-sm font-semibold">This photo could not be loaded.</p>
      ) : (
        <img
          src={currentSrc}
          alt={alt}
          draggable={false}
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          onError={() => {
            if (currentSrc !== src) setCurrentSrc(src);
            else setFailed(true);
          }}
          className={cn('max-h-full max-w-full select-none object-contain transition-opacity', loaded ? 'opacity-100' : 'opacity-0')}
        />
      )}
    </div>
  );
}
