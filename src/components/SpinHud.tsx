import { Coins, Flame } from 'lucide-react';
import { SCREEN_GUTTER } from '@/screens/arcade';
import { cn } from '@/lib/utils';

interface SpinHudProps {
  level: number;
  xpIntoLevel: number;
  xpPerLevel: number;
  coins: number;
  streak: number;
}

const CHIP =
  'inline-flex h-9 shrink-0 items-center gap-1 rounded-full border-[3px] border-brand-ink bg-white px-2.5 font-heading text-[15px] font-bold text-brand-ink';

/**
 * One compact row on the Spin screen: streak, coins, then level with a slim XP bar, so the
 * wheel gets the height. The Me screen keeps the roomier GameHud with full labels.
 */
export function SpinHud({ level, xpIntoLevel, xpPerLevel, coins, streak }: SpinHudProps) {
  const percent = Math.min(100, Math.round((xpIntoLevel / xpPerLevel) * 100));

  return (
    <section
      aria-label="Your progress"
      className={cn("flex items-center gap-2 pt-[max(0.75rem,env(safe-area-inset-top))] tabular-nums", SCREEN_GUTTER)}
    >
      <span className={CHIP} title={`${streak} day streak`}>
        <Flame size={18} aria-hidden="true" className="text-arcade-orange" />
        {streak}
        <span className="sr-only"> day streak</span>
      </span>
      <span className={CHIP} title={`${coins} coins`}>
        <Coins size={18} aria-hidden="true" />
        <span className="sr-only">Coins </span>
        {coins}
      </span>
      <div className="ml-auto flex min-w-0 flex-1 items-center gap-2 pl-1">
        <span className="shrink-0 font-heading text-sm font-bold text-brand-ink">Lv {level}</span>
        <div
          role="progressbar"
          aria-label="Experience points"
          aria-valuemin={0}
          aria-valuemax={xpPerLevel}
          aria-valuenow={xpIntoLevel}
          aria-valuetext={`Level ${level}, ${xpIntoLevel} of ${xpPerLevel} XP`}
          className="h-3.5 min-w-10 flex-1 overflow-hidden rounded-[7px] border-[3px] border-brand-ink bg-white"
        >
          <div
            className="h-full border-brand-ink bg-arcade-pink transition-[width] duration-500 motion-reduce:transition-none"
            style={{ width: `${percent}%`, borderRightWidth: percent === 0 ? 0 : 3 }}
          />
        </div>
        <span aria-hidden="true" className="hidden shrink-0 font-heading text-xs font-semibold text-brand-ink min-[380px]:inline">
          {xpIntoLevel}/{xpPerLevel}
        </span>
      </div>
    </section>
  );
}
