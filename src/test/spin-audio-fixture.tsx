import '@/index.css';
import { useState } from 'react';
import { RouletteWheel } from '@/components/RouletteWheel';
import type { Restaurant } from '@/types';

const places: Restaurant[] = Array.from({ length: 8 }, (_, index) => ({
  id: `manual-audio-${index}`, name: `Place ${index + 1}`, category: ['street food'],
  address: 'Your custom pick', coordinates: { lat: 0, lng: 0 }, hours: {}, rating: 0, priceRange: '$$',
}));

export function AudioFixture() {
  const [isSpinning, setIsSpinning] = useState(false);
  const [mounted, setMounted] = useState(true);
  return <div className="mx-auto max-w-md bg-arcade-yellow p-4">
    <button type="button" onClick={() => setMounted(false)}>Leave wheel</button>
    {mounted ? <RouletteWheel restaurants={places} totalCount={places.length}
      onSpinComplete={() => {}} isSpinning={isSpinning} setIsSpinning={setIsSpinning}
      onShuffle={() => {}} scrollOnSpin={false} /> : <p>Wheel closed</p>}
  </div>;
}
