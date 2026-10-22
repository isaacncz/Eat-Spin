import { Coins, Flame } from 'lucide-react';

interface SpinHudProps {
  level: number;
  xpIntoLevel: number;
  xpPerLevel: number;
  coins: number;
  streak: number;
}

const CHIP =
  'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border-[3px] border-brand-ink bg-white px-2.5 font-heading text-[15px] font-semibold text-brand-ink';

/**
 * Compact progress row for the Spin screen: streak, coins and level on one line, XP bar
 * under it. The Me screen keeps the roomier GameHud.
 */
export function SpinHud({ level, xpIntoLevel, xpPerLevel, coins, streak }: SpinHudProps) {
  const percent = Math.min(100, Math.round((xpIntoLevel / xpPerLevel) * 100));

  return (
    <section
      aria-label="Your progress"
      className="flex flex-col gap-2.5 px-5 pt-[max(0.75rem,env(safe-area-inset-top))]"
    >
      <div className="flex items-center gap-2">
        <span className={CHIP}>
          <Flame size={18} aria-hidden="true" className="text-arcade-orange" />
          {streak}
          {/* "day streak" needs room, so the narrowest phones get the flame and the number. */}
          <span className="hidden min-[380px]:inline">day streak</span>
          <span className="sr-only min-[380px]:hidden">day streak</span>
        </span>
        <span className={CHIP}>
          <Coins size={18} aria-hidden="true" />
          <span className="sr-only">Coins </span>
          {coins}
        </span>
        <span className="ml-auto min-w-0 truncate text-right font-heading text-sm font-semibold text-brand-ink">
          Lv {level}
          <span className="hidden min-[360px]:inline">
            {' '}
            · {xpIntoLevel}/{xpPerLevel} XP
          </span>
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Experience points"
        aria-valuemin={0}
        aria-valuemax={xpPerLevel}
        aria-valuenow={xpIntoLevel}
        aria-valuetext={`Level ${level}, ${xpIntoLevel} of ${xpPerLevel} XP`}
        className="h-3.5 overflow-hidden rounded-[7px] border-[3px] border-brand-ink bg-white"
      >
        <div
          className="h-full border-brand-ink bg-arcade-pink transition-[width] duration-500 motion-reduce:transition-none"
          style={{ width: `${percent}%`, borderRightWidth: percent === 0 ? 0 : 3 }}
        />
      </div>
    </section>
  );
}
