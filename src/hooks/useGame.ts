import { useCallback, useRef, useState } from 'react';

import {
  awardLetsGo,
  getLevel,
  getXpIntoLevel,
  loadGameState,
  saveGameState,
  XP_PER_LEVEL,
  type AwardResult,
} from '@/lib/gameStore';

export function useGame() {
  const [state, setState] = useState(loadGameState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const awardForLetsGo = useCallback((restaurantId: string): AwardResult => {
    const result = awardLetsGo(stateRef.current, restaurantId);
    if (result.awarded) {
      stateRef.current = result.state;
      setState(result.state);
      saveGameState(result.state);
    }
    return result;
  }, []);

  return {
    xp: state.xp,
    coins: state.coins,
    level: getLevel(state.xp),
    xpIntoLevel: getXpIntoLevel(state.xp),
    xpPerLevel: XP_PER_LEVEL,
    awardForLetsGo,
  };
}
