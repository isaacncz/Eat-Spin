import { useEffect, useState, type CSSProperties } from 'react';
import { Coins, Flame, Zap, type LucideIcon } from 'lucide-react';

import { RARITY_LABEL } from '@/lib/rarity';
import type { LetsGoReward } from '@/lib/letsGoReward';

// Fixed geometry (no randomness at render time) so the burst is the same every time.
const CONFETTI_COLORS = [
  'bg-arcade-pink',
  'bg-arcade-cyan',
  'bg-arcade-lime',
  'bg-arcade-yellow',
  'bg-arcade-orange',
  'bg-arcade-violet',
] as const;

const CONFETTI_PIECES = Array.from({ length: 24 }, (_, i) => {
  const angle = (i / 24) * Math.PI * 2 + (i % 3) * 0.12;
  const distance = 80 + ((i * 37) % 70);
  return {
    dx: Math.round(Math.cos(angle) * distance),
    // Bias upwards so the burst reads as a pop out of the tiles.
    dy: Math.round(Math.sin(angle) * distance) - 30,
    rotate: ((i * 53) % 360) - 180,
    delay: (i % 6) * 35,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  };
});

const CONFETTI_LIFETIME_MS = 1800;

/**
 * One-shot confetti burst made of CSS-animated pieces. Decorative only: hidden from
 * assistive tech, ignores pointer events, and removes itself when it is done.
 * Callers must not render it for people who prefer reduced motion (the CSS also hides it).
 */
export function ConfettiBurst() {
  const [done, setDone] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDone(true), CONFETTI_LIFETIME_MS);
    return () => window.clearTimeout(timer);
  }, []);

  if (done) return null;

  return (
    <div
      data-testid="confetti-burst"
      aria-hidden="true"
      className="confetti-burst pointer-events-none absolute left-1/2 top-1/2 z-10 h-0 w-0"
    >
      {CONFETTI_PIECES.map((piece, i) => (
        <span
          key={i}
          className={`confetti-piece absolute -left-1 -top-1.5 block h-3 w-2 rounded-sm border border-brand-ink ${piece.color}`}
          style={
            {
              '--dx': `${piece.dx}px`,
              '--dy': `${piece.dy}px`,
              '--rot': `${piece.rotate}deg`,
              '--delay': `${piece.delay}ms`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

interface TileProps {
  Icon: LucideIcon;
  value: string;
  label: string;
  surface: string;
  animate: boolean;
  delayMs: number;
}

function Tile({ Icon, value, label, surface, animate, delayMs }: TileProps) {
  return (
    <li
      data-testid="reward-tile"
      className={`flex flex-col items-center justify-center rounded-2xl border-[3px] border-brand-ink px-1 py-2 text-center text-brand-ink shadow-pop ${surface} ${
        animate ? 'reward-tile-pop' : ''
      }`}
      style={animate ? ({ '--delay': `${delayMs}ms` } as CSSProperties) : undefined}
    >
      <Icon size={18} aria-hidden="true" />
      <span className="font-heading text-2xl font-bold leading-none">{value}</span>
      <span className="mt-0.5 text-xs font-semibold leading-tight">{label}</span>
    </li>
  );
}

interface RewardTilesProps {
  reward: LetsGoReward;
  /** False for people who prefer reduced motion: tiles are static and there is no confetti. */
  animate: boolean;
}

/**
 * XP, coins and streak tiles shown on the result card after the reward is claimed.
 * Render it inside a persistent `role="status"` region so screen readers announce it.
 */
export function RewardTiles({ reward, animate }: RewardTilesProps) {
  const xpLabel = reward.awarded && reward.multiplier > 1 ? `XP (${RARITY_LABEL[reward.rarity]} ${reward.multiplier}x)` : 'XP';

  return (
    <div data-testid="reward-tiles" className="relative pb-1">
      {animate && reward.awarded && <ConfettiBurst />}
      <p className="mb-2 text-center font-heading text-lg font-bold text-brand-ink">
        {reward.awarded ? 'Reward claimed!' : 'Already rewarded today'}
      </p>
      <ul className="grid grid-cols-3 gap-2">
        <Tile
          Icon={Zap}
          value={`+${reward.xp}`}
          label={xpLabel}
          surface={reward.awarded ? 'bg-arcade-yellow' : 'bg-white'}
          animate={animate}
          delayMs={0}
        />
        <Tile
          Icon={Coins}
          value={`+${reward.coins}`}
          label="coins"
          surface={reward.awarded ? 'bg-arcade-cyan' : 'bg-white'}
          animate={animate}
          delayMs={110}
        />
        <Tile
          Icon={Flame}
          value={`${reward.streak}`}
          label="day streak"
          surface="bg-arcade-orange"
          animate={animate}
          delayMs={220}
        />
      </ul>
      {!reward.awarded && (
        <p className="mt-2 text-center text-xs font-medium text-brand-ink">
          You already earned XP for this place today. Come back tomorrow for more.
        </p>
      )}
    </div>
  );
}
