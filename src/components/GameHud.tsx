import { Flame, Coins } from 'lucide-react';

interface GameHudProps {
  level: number;
  xpIntoLevel: number;
  xpPerLevel: number;
  coins: number;
  streak: number;
}

/** Streak, coins, level and XP bar. */
export function GameHud({ level, xpIntoLevel, xpPerLevel, coins, streak }: GameHudProps) {
  const percent = Math.min(100, Math.round((xpIntoLevel / xpPerLevel) * 100));

  return (
    <section aria-label="Your progress" className="px-4 pt-4 sm:px-6">
      <div className="mx-auto flex max-w-4xl flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex h-10 items-center gap-1.5 rounded-full border-[3px] border-brand-ink bg-white px-3 font-heading text-base font-semibold text-brand-ink">
            <Flame size={18} aria-hidden="true" className="text-eatspin-orange" />
            {streak} day streak
          </span>
          <span className="inline-flex h-10 items-center gap-1.5 rounded-full border-[3px] border-brand-ink bg-white px-3 font-heading text-base font-semibold text-brand-ink">
            <Coins size={18} aria-hidden="true" className="text-brand-ink" />
            {coins}
          </span>
        </div>
        <div>
          <div className="mb-1 flex items-baseline justify-between font-heading text-sm font-semibold text-brand-ink">
            <span>Level {level} Foodie</span>
            <span>{xpIntoLevel} / {xpPerLevel} XP</span>
          </div>
          <div
            role="progressbar"
            aria-label="Experience points"
            aria-valuemin={0}
            aria-valuemax={xpPerLevel}
            aria-valuenow={xpIntoLevel}
            className="h-5 overflow-hidden rounded-full border-[3px] border-brand-ink bg-white"
          >
            <div className="h-full border-r-[3px] border-brand-ink bg-arcade-pink transition-[width] duration-500" style={{ width: `${percent}%` }} />
          </div>
        </div>
      </div>
    </section>
  );
}
