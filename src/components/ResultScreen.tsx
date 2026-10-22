import { useCallback, useEffect, useRef } from 'react';
import { Check, ChevronLeft, Heart, MapPin, Navigation, Phone, RefreshCw, Share2, Star } from 'lucide-react';

import { PhotoCarousel } from '@/components/PhotoCarousel';
import { RarityRibbon } from '@/components/RarityBadge';
import { RewardTiles } from '@/components/RewardReveal';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { foodCategories } from '@/data/restaurants';
import { formatLastVisit } from '@/lib/lastVisit';
import type { LetsGoReward } from '@/lib/letsGoReward';
import { getMapsUrl } from '@/lib/maps';
import type { Rarity } from '@/lib/rarity';
import { getSmartHoursLabel, type SmartHoursResult } from '@/lib/smartHours';
import { estimateTravelTime } from '@/lib/travelTime';
import { cn } from '@/lib/utils';
import type { Restaurant } from '@/types';

/** What the player had done at this place when the wheel stopped (frozen, like the rarity). */
export interface ResultVisit {
  lastVisitedAt?: number;
  visitCount?: number;
}

export interface ResultScreenProps {
  open: boolean;
  /** Called with false for the back button and Esc. */
  onOpenChange: (open: boolean) => void;
  restaurant: Restaurant;
  /** A place the player typed in: no address, hours or photos to show. */
  isManual: boolean;
  rarity: Rarity | null;
  /** Null when the host does not track visits (the last-visit line is then left out). */
  visit: ResultVisit | null;
  /** Set once "Let's go! Claim reward" has been tapped for this result. */
  claim: { reward: LetsGoReward | null } | null;
  /** Omit when the host has no reward flow: the primary button is then not shown. */
  onClaim?: () => void;
  /** False for people who prefer reduced motion: no confetti, no tile pop. */
  animate: boolean;
  onShare?: (cardElement: HTMLElement) => void | Promise<void>;
  onSave?: () => void;
  isSaved?: boolean;
  onSpinAgain?: () => void;
  canSpinAgain?: boolean;
  isSpinning?: boolean;
  onEditList?: () => void;
  /** Radix returns focus to a trigger, and this view has none, so the host picks the target. */
  onCloseAutoFocus?: (event: Event) => void;
}

const GUTTER =
  'pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))]';
const FOCUS_RING =
  'outline-none focus-visible:ring-[3px] focus-visible:ring-brand-ink focus-visible:ring-offset-2 focus-visible:ring-offset-arcade-pink';

const ICON_BUTTON = cn(
  'flex size-11 shrink-0 items-center justify-center rounded-[14px] border-[3px] border-brand-ink bg-white text-brand-ink',
  'shadow-[0_3px_0_#1E1B4B] transition-transform active:translate-y-[3px] active:shadow-none motion-reduce:transition-none',
  FOCUS_RING,
);
const PRIMARY_BUTTON = cn(
  'flex h-[60px] w-full items-center justify-center gap-2 rounded-[18px] border-4 border-brand-ink bg-arcade-lime',
  'font-heading text-xl font-bold text-brand-ink shadow-[0_5px_0_#1E1B4B] transition-transform',
  'active:translate-y-[3px] active:shadow-[0_2px_0_#1E1B4B] motion-reduce:transition-none',
  FOCUS_RING,
);
const SECONDARY_BUTTON = cn(
  'flex h-[52px] min-w-0 flex-1 items-center justify-center gap-1.5 rounded-2xl border-[3px] border-brand-ink bg-white px-3',
  'font-heading text-base font-semibold text-brand-ink shadow-[0_3px_0_#1E1B4B] transition-transform',
  'active:translate-y-[2px] active:shadow-none disabled:opacity-60 disabled:shadow-none motion-reduce:transition-none',
  FOCUS_RING,
);
const CHIP =
  'inline-flex items-center gap-1 rounded-xl border-[3px] border-brand-ink bg-white px-2.5 py-1 text-sm font-semibold text-brand-ink';
const TAG =
  'inline-flex items-center gap-1 rounded-full border-2 border-brand-ink px-2.5 py-0.5 text-xs font-semibold text-brand-ink';

/** Ink text on every surface. The status is always in the words too, never colour alone. */
const HOURS_SURFACE: Record<SmartHoursResult['status'], string> = {
  open: 'bg-arcade-lime',
  'closing-soon': 'bg-arcade-yellow',
  closed: 'bg-arcade-orange',
  unknown: 'bg-white',
};

/**
 * The result of a spin as a full-screen view: pink backdrop, the place on a white card,
 * and the actions pinned to the bottom. The middle scrolls, so on a short phone the pinned
 * buttons never sit on top of the card or the reward tiles.
 *
 * It is a modal dialog: focus moves in, Tab stays inside, Esc and the back button close it,
 * and the page behind cannot scroll. It covers the tab bar, as the design board does.
 */
export function ResultScreen({
  open,
  onOpenChange,
  restaurant,
  isManual,
  rarity,
  visit,
  claim,
  onClaim,
  animate,
  onShare,
  onSave,
  isSaved = false,
  onSpinAgain,
  canSpinAgain = true,
  isSpinning = false,
  onEditList,
  onCloseAutoFocus,
}: ResultScreenProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const tilesRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLElement | null>(null);

  // This view covers the tab bar, so toasts must sit above the pinned buttons instead of above
  // the bar. App's Toaster reads --toast-bottom and falls back to the tab bar height.
  const setFooter = useCallback((element: HTMLElement | null) => {
    footerRef.current = element;
    if (!element) return;
    const root = document.documentElement;
    const publish = () => root.style.setProperty('--toast-bottom', `${element.offsetHeight}px`);
    publish();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(publish);
    observer?.observe(element);
    return () => {
      observer?.disconnect();
      root.style.removeProperty('--toast-bottom');
      footerRef.current = null;
    };
  }, []);

  // The tiles appear under the card, which can be taller than a short screen. Bring them
  // into the scrolling area, above the pinned buttons.
  useEffect(() => {
    if (!claim) return;
    tilesRef.current?.scrollIntoView({ block: 'nearest', behavior: animate ? 'smooth' : 'auto' });
  }, [claim, animate]);

  // The claim button turns into the Maps link. Keep keyboard focus on that spot.
  useEffect(() => {
    if (!claim) return;
    footerRef.current?.querySelector<HTMLElement>('[data-primary-action]')?.focus({ preventScroll: true });
  }, [claim]);

  const hours = isManual ? null : getSmartHoursLabel(restaurant);
  const photos = restaurant.photos ?? [];
  const categories = restaurant.category.slice(0, 3);
  const hasSecondaryActions = Boolean(onSave || onSpinAgain || onEditList);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        onCloseAutoFocus={onCloseAutoFocus}
        className={cn(
          // Full screen, over the tab bar. The dialog's own zoom-95 is not removed by
          // tailwind-merge, so it is overridden to keep the slide a plain slide.
          'inset-0 flex w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 bg-arcade-pink p-0 text-brand-ink shadow-none sm:max-w-none',
          'data-[state=open]:slide-in-from-bottom-8 data-[state=closed]:slide-out-to-bottom-8',
          'data-[state=open]:!zoom-in-100 data-[state=closed]:!zoom-out-100',
        )}
      >
        {/* Decorative shapes from the board. Static, so nothing to turn off for reduced motion. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <span className="absolute left-[18px] top-[90px] size-4 rotate-[30deg] border-[3px] border-brand-ink bg-arcade-yellow" />
          <span className="absolute right-11 top-[66px] size-3.5 rounded-full border-[3px] border-brand-ink bg-arcade-cyan" />
          <span className="absolute right-3.5 top-[150px] size-[18px] rotate-[60deg] border-[3px] border-brand-ink bg-arcade-lime" />
        </div>

        <header className={cn('relative shrink-0 pt-[max(1rem,env(safe-area-inset-top))]', GUTTER)}>
          <div className="mx-auto flex w-full max-w-[480px] items-center gap-3">
            <button
              type="button"
              aria-label="Back to wheel"
              onClick={() => onOpenChange(false)}
              className={ICON_BUTTON}
            >
              <ChevronLeft size={22} strokeWidth={3} aria-hidden="true" />
            </button>
            <DialogTitle className="text-[28px] font-bold leading-none text-brand-ink">You got it!</DialogTitle>
            {onShare && (
              <button
                type="button"
                aria-label="Share this result"
                onClick={() => {
                  const card = cardRef.current;
                  if (card) void onShare(card);
                }}
                className={cn(ICON_BUTTON, 'ml-auto')}
              >
                <Share2 size={20} strokeWidth={2.5} aria-hidden="true" />
              </button>
            )}
          </div>
        </header>

        <DialogDescription className="sr-only">EatSpin picked {restaurant.name}.</DialogDescription>

        <div className={cn('relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain pb-4 pt-3', GUTTER)}>
          <div className="mx-auto w-full max-w-[480px]">
            {/* The capture area for Share: it includes room for the tab and the hard shadow. */}
            <div ref={cardRef} id="spin-result-card" className="pb-3 pt-5">
              <section
                className={cn(
                  'relative rounded-3xl border-4 border-brand-ink bg-white px-5 pb-5 pt-9 shadow-[0_8px_0_#1E1B4B]',
                  'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-300',
                )}
              >
                {rarity && <RarityRibbon rarity={rarity} />}

                <h3 className="font-heading text-[clamp(1.75rem,9vw,2.5rem)] font-bold leading-[1.05] text-brand-ink [overflow-wrap:anywhere]">
                  {restaurant.name}
                </h3>

                {!isManual && (
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {restaurant.distance !== undefined && <span className={CHIP}>{estimateTravelTime(restaurant.distance)}</span>}
                    {hours && <span className={cn(CHIP, HOURS_SURFACE[hours.status])}>{hours.label}</span>}
                    {restaurant.priceRange && <span className={CHIP}>{restaurant.priceRange}</span>}
                    {restaurant.rating > 0 && (
                      <span className={CHIP}>
                        <Star size={14} className="fill-arcade-yellow" aria-hidden="true" />
                        {restaurant.rating}
                        <span className="sr-only"> out of 5</span>
                      </span>
                    )}
                  </div>
                )}

                {visit && (
                  <p className="mt-2.5 text-[15px] font-medium text-eatspin-gray-1">
                    {formatLastVisit(visit.lastVisitedAt, visit.visitCount)}
                  </p>
                )}

                {!isManual && photos.length > 1 ? (
                  <PhotoCarousel
                    photos={photos}
                    alt={`Photos of ${restaurant.name}`}
                    interactiveDots={false}
                    className="mt-4"
                  />
                ) : !isManual && restaurant.image ? (
                  <div className="mt-4 overflow-hidden rounded-xl border-2 border-brand-ink">
                    <img
                      src={restaurant.image}
                      alt={`Photo of ${restaurant.name}`}
                      className="h-48 w-full object-cover"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : null}

                {!isManual && (
                  <ul className="mt-4 space-y-1 text-sm text-eatspin-gray-1">
                    <li className="flex items-start gap-2">
                      <MapPin size={16} className="mt-0.5 shrink-0 text-brand-orange" aria-hidden="true" />
                      <span>{restaurant.address}</span>
                    </li>
                    {/* Some places carry a placeholder such as "N/A" instead of a number. */}
                    {restaurant.phone && /\d/.test(restaurant.phone) && (
                      <li className="flex items-center gap-2">
                        <Phone size={16} className="shrink-0 text-brand-orange" aria-hidden="true" />
                        <a
                          href={`tel:${restaurant.phone}`}
                          className="inline-flex min-h-11 items-center font-semibold text-brand-ink underline underline-offset-2"
                        >
                          {restaurant.phone}
                        </a>
                      </li>
                    )}
                  </ul>
                )}

                {restaurant.description && (
                  <p className="mt-3 text-sm leading-relaxed text-eatspin-gray-1">{restaurant.description}</p>
                )}

                {categories.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {categories.map((id) => {
                      const config = foodCategories.find((category) => category.id === id);
                      return (
                        <span
                          key={id}
                          className={cn(TAG, 'bg-white')}
                          style={{ boxShadow: `0 2px 0 0 ${config?.color || '#FF4D8D'}` }}
                        >
                          {config?.icon} {config?.name}
                        </span>
                      );
                    })}
                  </div>
                )}

                {(restaurant.dineIn || restaurant.takeout || restaurant.delivery || restaurant.goodForGroups || restaurant.goodForChildren || restaurant.outdoorSeating) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {restaurant.dineIn && <span className={cn(TAG, 'bg-arcade-lime')}>🍽️ Dine-in</span>}
                    {restaurant.takeout && <span className={cn(TAG, 'bg-arcade-cyan')}>📦 Takeout</span>}
                    {restaurant.delivery && <span className={cn(TAG, 'bg-arcade-violet')}>🛵 Delivery</span>}
                    {restaurant.goodForGroups && <span className={cn(TAG, 'bg-arcade-yellow')}>👥 Groups</span>}
                    {restaurant.goodForChildren && <span className={cn(TAG, 'bg-arcade-cyan')}>👶 Kids</span>}
                    {restaurant.outdoorSeating && <span className={cn(TAG, 'bg-arcade-lime')}>🌿 Outdoor</span>}
                  </div>
                )}

                {restaurant.generativeSummary && (
                  <p className="mt-3 text-sm italic leading-relaxed text-eatspin-gray-1">
                    "{restaurant.generativeSummary}"
                  </p>
                )}

                {/* Branded footer: it is in the shared image too. */}
                <p className="mt-4 border-t-2 border-brand-ink/20 pt-3 text-center text-xs font-bold text-brand-orange">
                  🍴 EatSpin <span className="font-medium text-eatspin-gray-2">· Spin to decide what to eat</span>
                </p>
              </section>
            </div>

            {/* A persistent live region, so screen readers announce the reward when it appears. */}
            <div ref={tilesRef} role="status" aria-live="polite" className="mt-3 scroll-mb-4">
              {claim?.reward && <RewardTiles reward={claim.reward} animate={animate} />}
              {claim && (
                <p className="mt-3 text-center text-sm font-medium text-brand-ink">
                  Opening Maps. We'll ask how it was next time you open the app.
                </p>
              )}
            </div>
          </div>
        </div>

        <footer ref={setFooter} className={cn('relative shrink-0 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3', GUTTER)}>
          <div className="mx-auto flex w-full max-w-[480px] flex-col gap-3">
            {/* Claim once, then the same spot becomes a plain Maps link. */}
            {onClaim && !claim && (
              <button type="button" data-primary-action onClick={onClaim} className={PRIMARY_BUTTON}>
                <Navigation size={20} strokeWidth={2.5} aria-hidden="true" />
                Let's go! Claim reward
              </button>
            )}
            {onClaim && claim && (
              <a
                data-primary-action
                href={getMapsUrl(restaurant)}
                target="_blank"
                rel="noopener noreferrer"
                className={PRIMARY_BUTTON}
              >
                <Navigation size={20} strokeWidth={2.5} aria-hidden="true" />
                Open in Maps
              </a>
            )}

            {hasSecondaryActions && (
              <div className="flex gap-3">
                {onSpinAgain && (
                  <button
                    type="button"
                    onClick={onSpinAgain}
                    disabled={!canSpinAgain || isSpinning}
                    className={SECONDARY_BUTTON}
                  >
                    <RefreshCw size={18} aria-hidden="true" />
                    Spin again
                  </button>
                )}
                {onSave && (
                  <button
                    type="button"
                    onClick={onSave}
                    disabled={isSaved}
                    className={cn(SECONDARY_BUTTON, isSaved && 'bg-arcade-cyan disabled:opacity-100')}
                  >
                    {isSaved ? (
                      <Check size={18} strokeWidth={3} aria-hidden="true" />
                    ) : (
                      <Heart size={18} aria-hidden="true" />
                    )}
                    {isSaved ? 'Saved' : 'Save to list'}
                  </button>
                )}
                {onEditList && (
                  <button type="button" onClick={onEditList} className={SECONDARY_BUTTON}>
                    Edit list
                  </button>
                )}
              </div>
            )}
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
