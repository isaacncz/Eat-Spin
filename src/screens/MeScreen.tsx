import { QuestCard } from '@/components/QuestCard';
import SpinStatsPanel, { type SpinStatsPanelProps } from '@/components/SpinStatsPanel';
import { getLevelProgress } from '@/lib/levelProgress';
import { formatVisitCount, type MostVisitedPlace } from '@/lib/placeVisits';
import { cn } from '@/lib/utils';
import { SCREEN_GUTTER, SectionLabel } from '@/screens/arcade';
import { AboutEatSpin } from '@/sections/AboutEatSpin';

interface MeScreenProps {
  level: number;
  xpIntoLevel: number;
  xpPerLevel: number;
  coins: number;
  /** Consecutive days with at least one spin. */
  streak: number;
  quest: {
    title: string;
    rewardXp: number;
    progress: number;
    target: number;
    completed: boolean;
  };
  /** Top places by visit count, already ranked. */
  mostVisited: MostVisitedPlace[];
  /** Spin history numbers. The panel appears once there is at least one spin. */
  history: Omit<SpinStatsPanelProps, 'onShareWrapped'>;
  onShareWrapped: () => void;
  onStartSpinning: () => void;
}

/**
 * Me: level and XP, streak / coins / spins, today's quest, most visited places, the food
 * journey and the collapsed About EatSpin row. Every number comes from the same hooks the
 * Spin screen's HUD uses, passed in by the app, so there is one source of truth.
 */
export function MeScreen({
  level,
  xpIntoLevel,
  xpPerLevel,
  coins,
  streak,
  quest,
  mostVisited,
  history,
  onShareWrapped,
  onStartSpinning,
}: MeScreenProps) {
  const { percent, xpToNext } = getLevelProgress(xpIntoLevel, xpPerLevel);

  return (
    <div className="pb-2">
      <header className={cn('pt-6', SCREEN_GUTTER)}>
        <h1 className="font-heading text-[30px] font-bold leading-[1.1] text-brand-ink">Me</h1>
      </header>

      <div className={cn('flex flex-col gap-3.5 pt-4', SCREEN_GUTTER)}>
        <section
          aria-label="Level"
          className="flex flex-col gap-2.5 rounded-3xl border-4 border-brand-ink bg-white px-5 py-4 shadow-pop-lg"
        >
          <div className="flex items-center gap-3.5">
            <span
              aria-hidden="true"
              className="flex size-16 shrink-0 items-center justify-center rounded-full border-4 border-brand-ink bg-arcade-pink font-heading text-[28px] font-bold text-brand-ink"
            >
              {level}
            </span>
            <div className="min-w-0">
              <p className="font-heading text-[22px] font-bold leading-tight text-brand-ink">Level {level} Foodie</p>
              <p className="font-heading text-sm font-medium text-eatspin-gray-1">
                {xpToNext} XP to level {level + 1}
              </p>
            </div>
          </div>
          <div
            role="progressbar"
            aria-label="Experience points"
            aria-valuemin={0}
            aria-valuemax={xpPerLevel}
            aria-valuenow={xpIntoLevel}
            aria-valuetext={`${xpIntoLevel} of ${xpPerLevel} XP`}
            className="h-4 overflow-hidden rounded-lg border-[3px] border-brand-ink bg-white"
          >
            <div
              className={cn(
                'h-full bg-arcade-pink transition-[width] duration-500 motion-reduce:transition-none',
                percent > 0 && percent < 100 && 'border-r-[3px] border-brand-ink',
              )}
              style={{ width: `${percent}%` }}
            />
          </div>
        </section>

        <section aria-label="Stats" className="flex gap-2.5">
          <StatTile value={streak} label="Day streak" className="bg-arcade-orange" />
          <StatTile value={coins} label="Coins" className="bg-arcade-cyan" />
          <StatTile value={history.totalSpins} label="Spins" className="bg-arcade-lime" />
        </section>
      </div>

      <QuestCard
        title={quest.title}
        rewardXp={quest.rewardXp}
        progress={quest.progress}
        target={quest.target}
        completed={quest.completed}
      />

      <section aria-labelledby="most-visited-heading" className={cn('pt-3.5', SCREEN_GUTTER)}>
        <SectionLabel id="most-visited-heading">Most visited</SectionLabel>
        {mostVisited.length === 0 ? (
          <p className="rounded-2xl border-[3px] border-dashed border-brand-ink bg-white/70 p-3.5 font-heading text-sm font-medium text-brand-ink">
            Tap &quot;Let&apos;s go&quot; on a result and the places you visit most show up here.
          </p>
        ) : (
          <ol className="flex flex-col gap-2">
            {mostVisited.map((place, index) => (
              <li
                key={place.id}
                className="flex items-center gap-3 rounded-2xl border-[3px] border-brand-ink bg-white px-3 py-2 font-heading text-brand-ink"
              >
                <span aria-hidden="true" className="w-[22px] shrink-0 text-xl font-bold">{index + 1}</span>
                <span className="min-w-0 flex-1 break-words text-[17px] font-semibold leading-snug">{place.name}</span>
                <span className="shrink-0 text-sm font-semibold text-eatspin-gray-1">{formatVisitCount(place.visitCount)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {history.totalSpins > 0 && (
        <section className={cn('pt-3.5', SCREEN_GUTTER)}>
          <SpinStatsPanel {...history} onShareWrapped={onShareWrapped} />
        </section>
      )}

      <AboutEatSpin onStartSpinning={onStartSpinning} />
    </div>
  );
}

function StatTile({ value, label, className }: { value: number; label: string; className: string }) {
  return (
    <div
      className={cn(
        'min-w-0 flex-1 rounded-2xl border-[3px] border-brand-ink px-2 py-2.5 text-center font-heading text-brand-ink',
        className,
      )}
    >
      <p className="text-[26px] font-bold leading-tight">{value}</p>
      <p className="text-[13px] font-semibold leading-tight">{label}</p>
    </div>
  );
}
