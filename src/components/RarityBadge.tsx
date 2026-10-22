import { Circle, Gem, Sparkles, type LucideIcon } from 'lucide-react';

import { RARITY_HINT, RARITY_LABEL, RARITY_XP_MULTIPLIER, type Rarity } from '@/lib/rarity';

// Ink text on every tier colour. The tier is always spelled out in text, never colour alone.
const TIER_STYLE: Record<Rarity, { surface: string; Icon: LucideIcon }> = {
  common: { surface: 'bg-white', Icon: Circle },
  rare: { surface: 'bg-arcade-cyan', Icon: Sparkles },
  epic: { surface: 'bg-arcade-yellow', Icon: Gem },
};

interface RarityBadgeProps {
  rarity: Rarity;
  className?: string;
}

/** Small pill for list rows: icon plus the tier name. */
export function RarityBadge({ rarity, className = '' }: RarityBadgeProps) {
  const { surface, Icon } = TIER_STYLE[rarity];
  return (
    <span
      title={`${RARITY_LABEL[rarity]}: ${RARITY_HINT[rarity]}. ${RARITY_XP_MULTIPLIER[rarity]}x XP.`}
      className={`inline-flex items-center gap-1 rounded-full border-2 border-brand-ink px-2 py-0.5 font-heading text-xs font-semibold leading-tight text-brand-ink ${surface} ${className}`}
    >
      <Icon size={12} aria-hidden="true" />
      {RARITY_LABEL[rarity]}
    </span>
  );
}

/**
 * Tab that sits on the top edge of the result card. The parent must be `relative` and must
 * not clip overflow. The tier is spelled out in text; the explanation is read by screen
 * readers, and sighted players get it from the "last visit" line under the name.
 */
export function RarityRibbon({ rarity }: { rarity: Rarity }) {
  const { surface, Icon } = TIER_STYLE[rarity];
  return (
    <div
      data-testid="rarity-ribbon"
      data-rarity={rarity}
      className={`absolute -top-4 left-4 z-10 flex max-w-[calc(100%-2rem)] items-center gap-1.5 rounded-[14px] border-[3px] border-brand-ink px-3 py-1 text-brand-ink ${surface}`}
    >
      <Icon size={16} className="shrink-0" aria-hidden="true" />
      <p className="font-heading text-sm font-bold uppercase leading-tight tracking-[0.06em]">
        <span>{RARITY_LABEL[rarity]} place</span>
        <span aria-hidden="true"> &middot; </span>
        <span className="sr-only">, </span>
        <span>{RARITY_XP_MULTIPLIER[rarity]}x XP</span>
      </p>
      <span className="sr-only">{RARITY_HINT[rarity]}</span>
    </div>
  );
}
