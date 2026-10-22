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

/** Full-width band for the spin result card, directly under the card header strip. */
export function RarityRibbon({ rarity }: { rarity: Rarity }) {
  const { surface, Icon } = TIER_STYLE[rarity];
  return (
    <div
      data-testid="rarity-ribbon"
      data-rarity={rarity}
      className={`flex flex-col items-center justify-center gap-0.5 border-b-4 border-brand-ink px-4 py-2 text-center text-brand-ink ${surface}`}
    >
      <p className="flex items-center justify-center gap-1.5 font-heading text-base font-bold uppercase tracking-wide">
        <Icon size={18} aria-hidden="true" />
        <span>{RARITY_LABEL[rarity]} place</span>
        <span aria-hidden="true">&middot;</span>
        <span>{RARITY_XP_MULTIPLIER[rarity]}x XP</span>
      </p>
      <p className="text-xs font-medium">{RARITY_HINT[rarity]}</p>
    </div>
  );
}
