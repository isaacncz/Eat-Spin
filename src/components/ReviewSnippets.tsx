import { useState } from 'react';
import { Star, ChevronDown, ChevronUp } from 'lucide-react';
import type { PlaceReview } from '@/types';
import { cn } from '@/lib/utils';

interface ReviewSnippetsProps {
  reviews: PlaceReview[];
  className?: string;
  /** Max reviews to show initially (default: 2). */
  initialCount?: number;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={10}
          className={cn(
            star <= rating ? 'text-[#FFD700] fill-[#FFD700]' : 'text-gray-300',
          )}
        />
      ))}
    </span>
  );
}

/**
 * Shows 2-3 review snippets from Google Places.
 * Expandable to show all reviews with a "Show more" toggle.
 */
export function ReviewSnippets({
  reviews,
  className,
  initialCount = 2,
}: ReviewSnippetsProps) {
  const [expanded, setExpanded] = useState(false);

  if (reviews.length === 0) return null;

  const visibleReviews = expanded ? reviews : reviews.slice(0, initialCount);
  const hasMore = reviews.length > initialCount;

  return (
    <div className={cn('mt-3', className)}>
      <div className="text-left space-y-2.5">
        {visibleReviews.map((review, i) => (
          <div key={i} className="bg-eatspin-peach/20 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2 mb-1">
              {review.authorPhotoUri ? (
                <img
                  src={review.authorPhotoUri}
                  alt=""
                  className="w-5 h-5 rounded-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-brand-orange/20 flex items-center justify-center text-[9px] font-bold text-brand-orange">
                  {review.authorName.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-[11px] font-medium text-brand-black truncate max-w-[120px]">
                {review.authorName}
              </span>
              <StarRating rating={review.rating} />
              {review.relativeTime && (
                <span className="text-[10px] text-eatspin-gray-2 ml-auto shrink-0">
                  {review.relativeTime}
                </span>
              )}
            </div>
            <p className="text-[11px] leading-relaxed text-eatspin-gray-1 line-clamp-2">
              {review.text}
            </p>
          </div>
        ))}
      </div>

      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1.5 text-[11px] font-medium text-brand-orange hover:text-brand-orange/80 flex items-center gap-0.5 mx-auto transition-colors"
        >
          {expanded ? (
            <>
              Show less <ChevronUp size={12} />
            </>
          ) : (
            <>
              {reviews.length - initialCount} more review{reviews.length - initialCount > 1 ? 's' : ''}{' '}
              <ChevronDown size={12} />
            </>
          )}
        </button>
      )}
    </div>
  );
}
