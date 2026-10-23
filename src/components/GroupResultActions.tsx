import { useRef, useState } from 'react';
import { Heart, MapPin, Share2 } from 'lucide-react';
import { ArcadeButton } from '@/screens/arcade';
import { RewardTiles } from '@/components/RewardReveal';
import { LevelUpDialog } from '@/components/LevelUpDialog';
import { getMapsUrl } from '@/lib/maps';
import { getRarity, type Rarity } from '@/lib/rarity';
import type { LetsGoReward } from '@/lib/letsGoReward';
import type { Restaurant } from '@/types';

/** Mounted with a room-event key so reward feedback belongs to that revealed result. */
export function GroupResultActions({ restaurant, isSaved, lastVisitedAt, onSave, onLetsGo, onShare }: {
  restaurant: Restaurant;
  isSaved: boolean;
  lastVisitedAt: number | undefined;
  onSave: () => void;
  onLetsGo: (restaurant: Restaurant, rarity: Rarity) => LetsGoReward;
  onShare: (element: HTMLElement) => void;
}) {
  const [rarity] = useState(() => getRarity(lastVisitedAt));
  const [reward, setReward] = useState<LetsGoReward | null>(null);
  const [levelUpOpen, setLevelUpOpen] = useState(false);
  const claimed = useRef(false);
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  return <div className="space-y-3">
    {reward ? <a href={getMapsUrl(restaurant)} target="_blank" rel="noopener noreferrer"
      className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border-[3px] border-brand-ink bg-arcade-lime px-3 font-bold">
      <MapPin size={18} aria-hidden="true" />Open in Maps
    </a> : <ArcadeButton variant="lime" className="w-full" onClick={() => {
      if (claimed.current) return;
      claimed.current = true;
      const next = onLetsGo(restaurant, rarity);
      setReward(next);
      if (next.awarded && next.leveledUp) setLevelUpOpen(true);
    }}>Let&apos;s go! Claim reward</ArcadeButton>}
    <div className="flex flex-wrap gap-2">
      <ArcadeButton className="flex-1 px-3 text-sm" disabled={isSaved} onClick={onSave}>
        <Heart size={18} aria-hidden="true" />{isSaved ? 'Saved' : 'Save place'}
      </ArcadeButton>
      <ArcadeButton className="flex-1 px-3 text-sm" onClick={event => {
        const card = event.currentTarget.closest<HTMLElement>('[data-room-result]');
        if (card) onShare(card);
      }}><Share2 size={18} aria-hidden="true" />Share result</ArcadeButton>
    </div>
    {reward && <RewardTiles reward={reward} animate={!reduceMotion} />}
    {reward?.leveledUp && <LevelUpDialog open={levelUpOpen} level={reward.level} onOpenChange={setLevelUpOpen} />}
  </div>;
}
