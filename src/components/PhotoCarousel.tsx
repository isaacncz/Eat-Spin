import { useState, useEffect } from 'react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel';
import { cn } from '@/lib/utils';

interface PhotoCarouselProps {
  photos: string[];
  alt: string;
  className?: string;
}

/**
 * Swipeable photo carousel for restaurant result cards.
 * Shows dot indicators when multiple photos are available.
 */
export function PhotoCarousel({ photos, alt, className }: PhotoCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [api, setApi] = useState<CarouselApi>();

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setCurrentIndex(api.selectedScrollSnap());
    api.on('select', onSelect);
    onSelect(); // sync initial state
    return () => { api.off('select', onSelect); };
  }, [api]);

  if (photos.length === 0) return null;

  // Single photo — no carousel needed
  if (photos.length === 1) {
    return (
      <div className={cn('overflow-hidden rounded-xl border-2 border-brand-ink', className)}>
        <img
          src={photos[0]}
          alt={alt}
          className="h-48 w-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
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
              <img
                src={photo}
                alt={`${alt} — photo ${i + 1}`}
                className="h-48 w-full object-cover"
                loading={i === 0 ? 'eager' : 'lazy'}
                referrerPolicy="no-referrer"
              />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      {/* Dot indicators */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
        {photos.map((_, i) => (
          <button
            key={i}
            aria-label={`Go to photo ${i + 1}`}
            className={cn(
              'h-1.5 rounded-full transition-all duration-200',
              i === currentIndex
                ? 'w-4 bg-white shadow-sm'
                : 'w-1.5 bg-white/60',
            )}
            onClick={() => api?.scrollTo(i)}
          />
        ))}
      </div>

      {/* Photo counter badge */}
      <div className="absolute top-2 right-2 bg-black/50 text-white text-[10px] font-medium px-1.5 py-0.5 rounded-md">
        {currentIndex + 1}/{photos.length}
      </div>
    </div>
  );
}
