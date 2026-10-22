import { Check, Target } from 'lucide-react';

interface QuestCardProps {
  title: string;
  rewardXp: number;
  progress: number;
  target: number;
  completed: boolean;
}

/** Today's quest. Sits under the GameHud and shares its look. */
export function QuestCard({ title, rewardXp, progress, target, completed }: QuestCardProps) {
  const percent = Math.min(100, Math.round((progress / target) * 100));

  return (
    <section aria-label="Daily quest" className="px-4 pt-3 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <div
          data-testid="quest-card"
          data-completed={completed}
          className={`flex items-center gap-3 rounded-2xl border-[3px] border-brand-ink p-3 shadow-pop ${
            completed ? 'bg-arcade-lime' : 'bg-white'
          }`}
        >
          <span
            aria-hidden="true"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-[3px] border-brand-ink bg-arcade-cyan text-brand-ink"
          >
            {completed ? <Check size={20} /> : <Target size={20} />}
          </span>

          <div className="min-w-0 flex-1">
            <p className="font-heading text-xs font-semibold uppercase tracking-wide text-brand-ink">Daily quest</p>
            <p className="font-heading text-base font-semibold leading-snug text-brand-ink">{title}</p>

            {completed ? (
              <p className="font-heading text-sm font-semibold text-brand-ink">Completed</p>
            ) : target > 1 ? (
              <div className="mt-1 flex items-center gap-2">
                <div
                  role="progressbar"
                  aria-label="Quest progress"
                  aria-valuemin={0}
                  aria-valuemax={target}
                  aria-valuenow={progress}
                  className="h-4 min-w-0 flex-1 overflow-hidden rounded-full border-[3px] border-brand-ink bg-white"
                >
                  <div
                    className="h-full border-r-[3px] border-brand-ink bg-arcade-pink transition-[width] duration-500 motion-reduce:transition-none"
                    style={{ width: `${percent}%`, borderRightWidth: percent === 0 ? 0 : undefined }}
                  />
                </div>
                <span className="font-heading text-sm font-semibold text-brand-ink">
                  {progress} / {target}
                </span>
              </div>
            ) : null}
          </div>

          <span className="inline-flex h-10 shrink-0 items-center rounded-full border-[3px] border-brand-ink bg-arcade-yellow px-3 font-heading text-base font-semibold text-brand-ink">
            +{rewardXp} XP
          </span>
        </div>
      </div>
    </section>
  );
}
