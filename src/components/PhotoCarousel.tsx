import { useState, useEffect, useRef } from 'react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel';
import { Maximize2 } from 'lucide-react';
import { PhotoLightbox } from '@/components/PhotoLightbox';
import { cn } from '@/lib/utils';

const openPhotoButton =
  'block w-full cursor-zoom-in outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-orange';

/** Decorative corner icon: the photo itself is the tap target that opens the viewer. */
function ExpandHint() {
  return (
    <span
      aria-hidden="true"
      data-share-ignore=""
      className="pointer-events-none absolute bottom-2 right-2 rounded-md bg-black/50 p-1 text-white"
    >
      <Maximize2 size={12} />
    </span>
  );
}

interface PhotoCarouselProps {
  photos: string[];
  alt: string;
  className?: string;
  /**
   * Dots as buttons (default). Screens that hold every control to 44px turn this off: the
   * dots then only show where you are, and swiping or the arrow keys still change photo.
   */
  interactiveDots?: boolean;
}

/**
 * Swipeable photo carousel for restaurant result cards.
 * Shows dot indicators when multiple photos are available. Tapping a photo opens the
 * full-screen viewer, which requests nothing until then.
 */
export function PhotoCarousel(props: PhotoCarouselProps) {
  return <PhotoCarouselView key={props.photos.join('\n')} {...props} />;
}
function PhotoCarouselView({ photos, alt, className, interactiveDots = true }: PhotoCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [requested, setRequested] = useState<Set<number>>(() => new Set([0]));
  const [api, setApi] = useState<CarouselApi>();
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const slideButtons = useRef<(HTMLButtonElement | null)[]>([]);
  const openedIndexRef = useRef(0);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => {
      const index = api.selectedScrollSnap();
      setCurrentIndex(index);
      setRequested((previous) => previous.has(index) ? previous : new Set([...previous, index]));
    };
    api.on('select', onSelect);
    onSelect(); // sync initial state
    return () => { api.off('select', onSelect); };
  }, [api]);

  if (photos.length === 0) return null;

  // Open on the photo that is on screen. A slide's button can hold keyboard focus after the
  // carousel moved on (arrow keys), so the clicked slide is not always the visible one.
  const openViewer = () => {
    openedIndexRef.current = currentIndex;
    setViewerIndex(currentIndex);
  };
  // Radix cannot return focus (the viewer has no trigger). Return it to the opened photo's own
  // button, without scrolling: focusing a slide inside the clipped track would shift the carousel.
  const returnFocus = () => slideButtons.current[openedIndexRef.current]?.focus({ preventScroll: true });
  const viewer = viewerIndex === null ? null : (
    <PhotoLightbox
      photos={photos}
      startIndex={viewerIndex}
      alt={alt}
      onClose={() => setViewerIndex(null)}
      onReturnFocus={returnFocus}
    />
  );

  // Single photo — no carousel needed
  if (photos.length === 1) {
    return (
      <div className={cn('relative overflow-hidden rounded-xl border-2 border-brand-ink', className)}>
        <button
          type="button"
          ref={(element) => { slideButtons.current[0] = element; }}
          aria-label={`View ${alt} larger`}
          onClick={openViewer}
          className={openPhotoButton}
        >
          <img
            src={photos[0]}
            alt={alt}
            className="h-48 w-full object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        </button>
        <ExpandHint />
        {viewer}
      </div>
    );
  }

  return (
    <div className={cn('relative', className)}>
      <Carousel
        opts={{ loop: true, align: 'start' }}
        setApi={setApi}
        className="overflow-hidden rounded-xl border-2 border-brand-ink"
      >
        <CarouselContent className="ml-0">
          {photos.map((photo, i) => (
            <CarouselItem key={i} className="pl-0">
              {requested.has(i) ? (
                <button
                  type="button"
                  ref={(element) => { slideButtons.current[i] = element; }}
                  aria-label={`View photo ${i + 1} of ${photos.length} larger`}
                  onClick={openViewer}
                  className={openPhotoButton}
                >
                  <img
                    src={photo}
                    alt={`${alt} — photo ${i + 1}`}
                    className="h-48 w-full object-cover"
                    loading={i === 0 ? 'eager' : 'lazy'}
                    referrerPolicy="no-referrer"
                  />
                </button>
              ) : <div className="h-48 w-full bg-brand-linen" aria-label={`${alt} — photo ${i + 1}, not loaded`} />}
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
      <ExpandHint />
      {viewer}

      {/* Dot indicators */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
        {photos.map((_, i) => {
          const dotClass = cn(
            'h-1.5 rounded-full transition-all duration-200',
            i === currentIndex ? 'w-4 bg-white shadow-sm' : 'w-1.5 bg-white/60',
          );
          return interactiveDots ? (
            <button
              key={i}
              aria-label={`Go to photo ${i + 1}`}
              className={dotClass}
              onClick={() => api?.scrollTo(i)}
            />
          ) : (
            <span key={i} aria-hidden="true" className={dotClass} />
          );
        })}
      </div>

      {/* Photo counter badge */}
      <div className="absolute top-2 right-2 bg-black/50 text-white text-[10px] font-medium px-1.5 py-0.5 rounded-md">
        {currentIndex + 1}/{photos.length}
      </div>
    </div>
  );
}
