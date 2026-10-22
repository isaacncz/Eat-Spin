import { useEffect, useState } from 'react';

import {
  PLACES_BLOCK_THRESHOLD,
  PLACES_MONTHLY_CAP,
  subscribePlacesUsage,
  type PlacesUsageSnapshot,
} from '@/lib/placesUsage';

const initial: PlacesUsageSnapshot = {
  used: { nearby: 0, text: 0 },
  blocked: { nearby: false, text: false },
};

/** Live monthly Google Places budget state. `nearbyBlocked` gates auto-mode spinning. */
export function usePlacesBudget() {
  const [snapshot, setSnapshot] = useState<PlacesUsageSnapshot>(initial);

  useEffect(() => subscribePlacesUsage(setSnapshot), []);

  return {
    nearbyUsed: snapshot.used.nearby,
    textUsed: snapshot.used.text,
    nearbyBlocked: snapshot.blocked.nearby,
    textBlocked: snapshot.blocked.text,
    cap: PLACES_MONTHLY_CAP,
    blockAt: PLACES_BLOCK_THRESHOLD,
  };
}
