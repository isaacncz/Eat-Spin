import { Star, MapPin, Clock3, Phone } from 'lucide-react';
import type { Restaurant } from '@/types';
import { foodCategories } from '@/data/restaurants';
import { PhotoCarousel } from '@/components/PhotoCarousel';
import { ReviewSnippets } from '@/components/ReviewSnippets';
import { getSmartHoursLabel } from '@/lib/smartHours';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';

interface RestaurantDetailDrawerProps {
  restaurant: Restaurant | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Full-detail bottom drawer for a restaurant.
 * Composes: photo carousel, hours, reviews, map link.
 */
export function RestaurantDetailDrawer({
  restaurant,
  open,
  onOpenChange,
}: RestaurantDetailDrawerProps) {
  if (!restaurant) return null;

  const hoursInfo = getSmartHoursLabel(restaurant);
  const allPhotos = restaurant.photos ?? (restaurant.image ? [restaurant.image] : []);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh] mx-auto max-w-lg">
        <div className="overflow-y-auto">
          {/* Photo carousel — full width */}
          {allPhotos.length > 0 && (
            <PhotoCarousel
              photos={allPhotos}
              alt={`Photos of ${restaurant.name}`}
              className="mx-4 mt-2"
            />
          )}

          <DrawerHeader className="pb-2">
            <DrawerTitle className="text-xl font-heading font-bold text-brand-black">
              {restaurant.name}
            </DrawerTitle>
            <DrawerDescription asChild>
              <div className="space-y-2">
                {/* Rating + price + distance */}
                <div className="flex items-center gap-2 text-sm">
                  <span className="inline-flex items-center gap-1">
                    <Star size={14} className="text-[#FFD700] fill-[#FFD700]" />
                    <span className="font-semibold text-brand-black">{restaurant.rating}</span>
                    {restaurant.userRatingCount && (
                      <span className="text-eatspin-gray-2">({restaurant.userRatingCount})</span>
                    )}
                  </span>
                  <span className="text-eatspin-gray-3">·</span>
                  <span className="font-semibold text-brand-orange">{restaurant.priceRange}</span>
                  {restaurant.distance !== undefined && (
                    <>
                      <span className="text-eatspin-gray-3">·</span>
                      <span className="text-eatspin-gray-1">
                        {restaurant.distance < 1
                          ? `${Math.round(restaurant.distance * 1000)}m`
                          : `${restaurant.distance.toFixed(1)}km`}
                      </span>
                    </>
                  )}
                </div>

                {/* Hours badge */}
                <div className="flex items-center gap-1.5">
                  <Clock3
                    size={14}
                    className={
                      hoursInfo.status === 'closing-soon'
                        ? 'text-amber-500'
                        : hoursInfo.status === 'closed'
                          ? 'text-red-400'
                          : 'text-emerald-500'
                    }
                  />
                  <span
                    className={`text-sm ${
                      hoursInfo.status === 'closing-soon'
                        ? 'text-amber-600 font-medium'
                        : hoursInfo.status === 'closed'
                          ? 'text-red-400'
                          : 'text-emerald-600'
                    }`}
                  >
                    {hoursInfo.label}
                  </span>
                </div>

                {/* Address */}
                <div className="flex items-start gap-1.5">
                  <MapPin size={14} className="text-eatspin-gray-2 mt-0.5 shrink-0" />
                  <span className="text-sm text-eatspin-gray-1">{restaurant.address}</span>
                </div>

                {/* Phone */}
                {restaurant.phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone size={14} className="text-eatspin-gray-2 shrink-0" />
                    <a href={`tel:${restaurant.phone}`} className="text-sm text-brand-orange hover:underline">
                      {restaurant.phone}
                    </a>
                  </div>
                )}
              </div>
            </DrawerDescription>
          </DrawerHeader>

          <div className="px-4 pb-4 space-y-4">
            {/* Service + Vibe badges */}
            {(restaurant.delivery || restaurant.takeout || restaurant.dineIn ||
              restaurant.goodForGroups || restaurant.goodForChildren || restaurant.outdoorSeating) && (
              <div className="flex flex-wrap gap-1.5">
                {restaurant.dineIn && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                    🍽️ Dine-in
                  </span>
                )}
                {restaurant.takeout && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                    📦 Takeout
                  </span>
                )}
                {restaurant.delivery && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                    🛵 Delivery
                  </span>
                )}
                {restaurant.goodForGroups && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                    👥 Groups
                  </span>
                )}
                {restaurant.goodForChildren && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-cyan-50 text-cyan-700 border border-cyan-200">
                    👶 Kids
                  </span>
                )}
                {restaurant.outdoorSeating && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                    🌿 Outdoor
                  </span>
                )}
              </div>
            )}

            {/* Category tags */}
            {restaurant.category.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {restaurant.category.map((cat) => {
                  const cfg = foodCategories.find((c) => c.id === cat);
                  return (
                    <span
                      key={cat}
                      className="px-2.5 py-1 rounded-full border-2 border-brand-ink bg-white text-xs font-semibold text-brand-ink"
                      style={{ boxShadow: `0 2px 0 0 ${cfg?.color || '#FF4D8D'}` }}
                    >
                      {cfg?.icon} {cfg?.name}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Description */}
            {restaurant.description && (
              <p className="text-sm text-eatspin-gray-1 leading-relaxed">
                {restaurant.description}
              </p>
            )}

            {/* AI Summary */}
            {restaurant.generativeSummary && (
              <p className="text-sm italic text-eatspin-gray-1 leading-relaxed bg-arcade-yellow/30 rounded-lg p-3">
                "{restaurant.generativeSummary}"
              </p>
            )}

            {/* Reviews — show all expanded */}
            {restaurant.reviews && restaurant.reviews.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-brand-black mb-1">Reviews</h4>
                <ReviewSnippets reviews={restaurant.reviews} initialCount={5} />
              </div>
            )}

            {/* Action buttons */}
            <div className="pt-2">
              {restaurant.googleMapsUri && (
                <Button
                  className="w-full h-11 bg-brand-orange hover:bg-brand-orange/90 text-white font-heading font-bold rounded-xl"
                  onClick={() => window.open(restaurant.googleMapsUri, '_blank', 'noopener,noreferrer')}
                >
                  <MapPin size={16} className="mr-1.5" />
                  Open in Maps
                </Button>
              )}
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
