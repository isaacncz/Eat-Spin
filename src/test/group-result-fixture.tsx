import { createRoot } from 'react-dom/client';
import { RouletteWheel } from '@/components/RouletteWheel';
import type { Restaurant } from '@/types';
export function mountGroupResult(animate: boolean) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const restaurant: Restaurant = { id: 'manual-test-winner', name: 'Committed winner', category: ['street food'],
    address: 'Your custom pick', coordinates: { lat: 0, lng: 0 }, hours: {}, rating: 0, priceRange: '$$' };
  (window as unknown as { restoredCompletions: number }).restoredCompletions = 0;
  createRoot(container).render(<RouletteWheel restaurants={[restaurant]} totalCount={1}
    onSpinComplete={() => { (window as unknown as { restoredCompletions: number }).restoredCompletions += 1; }}
    isSpinning={false} setIsSpinning={() => {}} onShuffle={() => {}}
    externalSpin={{ spinId: 'room-fixed-event', winnerIndex: 0, restaurant, animate }} />);
}
