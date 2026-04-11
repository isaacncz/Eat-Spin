import { Share2, Flame, MapPin, Trophy, Dices } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { MealTime, Restaurant } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SpinStatsPanelProps {
  totalSpins: number;
  uniqueRestaurants: number;
  currentStreak: number;
  topCategory: string | null;
  spinsThisMonth: number;
  recentSpins: Array<{
    restaurant: Restaurant;
    timestamp: string | number | Date;
    mealTime: MealTime;
  }>;
  onShareWrapped: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatRelativeTime = (timestamp: Date | string | number): string => {
  const ms = Date.now() - new Date(timestamp).getTime();
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
};

const MEAL_LABELS: Record<MealTime, string> = {
  breakfast: '🌅 breakfast',
  lunch: '☀️ lunch',
  dinner: '🌙 dinner',
  none: '',
};

const STREAK_MESSAGES: readonly string[] = [
  "You're on fire! Keep the streak alive! 🔥",
  'Unstoppable foodie energy! 🚀',
  'Streak legend in the making! 💪',
  'Your taste buds never rest! 🎉',
];

/** Pick a deterministic but varied message based on the streak value. */
const getStreakMessage = (streak: number): string =>
  STREAK_MESSAGES[streak % STREAK_MESSAGES.length]!;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface StatCardProps {
  icon: React.ReactNode;
  value: React.ReactNode;
  label: string;
  highlight?: boolean;
}

function StatCard({ icon, value, label, highlight }: StatCardProps) {
  return (
    <div
      className={
        'flex flex-col items-center gap-1 rounded-xl bg-white px-3 py-3 shadow-sm transition-shadow' +
        (highlight
          ? ' ring-2 ring-brand-orange/40 shadow-[0_0_12px_rgba(255,140,50,0.25)]'
          : '')
      }
    >
      <span className="text-lg">{icon}</span>
      <p className="font-heading text-2xl font-bold text-brand-black">{value}</p>
      <p className="text-[11px] leading-tight text-eatspin-gray-1">{label}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function SpinStatsPanel({
  totalSpins,
  uniqueRestaurants,
  currentStreak,
  topCategory,
  spinsThisMonth,
  recentSpins,
  onShareWrapped,
}: SpinStatsPanelProps) {
  const hasSpins = totalSpins > 0;

  return (
    <section className="mb-6 rounded-2xl border border-eatspin-peach/60 bg-gradient-to-br from-white to-brand-linen/50 p-4 sm:p-5">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-heading text-lg font-bold text-brand-black">
            🏆 My Food Journey
          </h3>
          <p className="text-sm text-eatspin-gray-1">
            Your personal stats and recent spin timeline.
          </p>
        </div>
      </div>

      {/* ── Empty state ────────────────────────────────────────── */}
      {!hasSpins && (
        <div className="mt-6 flex flex-col items-center gap-2 py-8 text-center">
          <span className="text-4xl">🎰</span>
          <p className="font-heading text-base font-semibold text-brand-black">
            Start spinning to build your food story!
          </p>
          <p className="max-w-xs text-sm text-eatspin-gray-1">
            Every spin adds to your journey — discover streaks, top cuisines,
            and shareable stats.
          </p>
        </div>
      )}

      {/* ── Stat cards ─────────────────────────────────────────── */}
      {hasSpins && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatCard
              icon={<Dices className="size-5 text-brand-orange" />}
              value={totalSpins}
              label="Total Spins"
            />
            <StatCard
              icon={<MapPin className="size-5 text-brand-orange" />}
              value={uniqueRestaurants}
              label="Unique Places"
            />
            <StatCard
              icon={<Flame className="size-5 text-brand-orange" />}
              value={
                <span className="inline-flex items-center gap-1">
                  {currentStreak}
                  {currentStreak >= 3 && <span className="animate-pulse">🔥</span>}
                </span>
              }
              label={`Day Streak`}
              highlight={currentStreak >= 3}
            />
            <StatCard
              icon={<Trophy className="size-5 text-brand-orange" />}
              value={topCategory ?? '—'}
              label="Top Cuisine"
            />
          </div>

          {/* ── Streak celebration ──────────────────────────────── */}
          {currentStreak >= 3 && (
            <p className="mt-3 rounded-lg bg-brand-orange/10 px-3 py-2 text-center text-sm font-medium text-brand-orange">
              {getStreakMessage(currentStreak)}
            </p>
          )}

          {/* ── Monthly counter ────────────────────────────────── */}
          <p className="mt-3 text-xs text-eatspin-gray-1">
            This month:{' '}
            <strong className="text-brand-black">{spinsThisMonth}</strong> spin
            {spinsThisMonth === 1 ? '' : 's'}
          </p>

          {/* ── Recent spins timeline ──────────────────────────── */}
          <div className="mt-2 rounded-xl border border-eatspin-peach/50 bg-white">
            <div className="flex items-center justify-between px-3 py-2 text-xs text-eatspin-gray-1">
              <span className="font-medium">📜 Recent Spins</span>
              <span>{recentSpins.length} shown</span>
            </div>

            <ul className="max-h-56 divide-y divide-eatspin-peach/30 overflow-y-auto px-3 pb-2">
              {recentSpins.length === 0 ? (
                <li className="py-3 text-sm text-eatspin-gray-1">
                  No spins yet. Spin now to build your history.
                </li>
              ) : (
                recentSpins.map((spin, index) => (
                  <li
                    key={`${spin.restaurant.id}-${index}`}
                    className="flex items-center justify-between gap-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-brand-black">
                        {spin.restaurant.name}
                      </p>
                      <p className="text-xs text-eatspin-gray-1">
                        {spin.mealTime !== 'none'
                          ? `${MEAL_LABELS[spin.mealTime]} • `
                          : ''}
                        {spin.restaurant.category?.[0] ?? 'uncategorized'}
                      </p>
                    </div>
                    <span className="flex-shrink-0 text-xs text-eatspin-gray-2">
                      {formatRelativeTime(spin.timestamp)}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>

          {/* ── Share button ───────────────────────────────────── */}
          <div className="mt-4 flex justify-center">
            <Button
              type="button"
              variant="outline"
              className="gap-2 border-brand-orange/50 text-brand-orange hover:bg-brand-orange/10"
              onClick={onShareWrapped}
            >
              <Share2 className="size-4" />
              Share My Food Journey
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
