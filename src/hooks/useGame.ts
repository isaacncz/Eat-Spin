import { useCallback, useRef, useState } from 'react';

import {
  applyQuestEvent,
  awardLetsGo,
  getLevel,
  getXpIntoLevel,
  loadGameState,
  saveGameState,
  toLocalDayKey,
  XP_PER_LEVEL,
  type AwardResult,
  type QuestEventResult,
} from '@/lib/gameStore';
import { getQuestById, getQuestForDay, resolveQuestProgress, type QuestDef, type QuestEvent } from '@/lib/quests';

export interface QuestView {
  quest: QuestDef;
  progress: number;
  completed: boolean;
}

export function useGame() {
  const [state, setState] = useState(loadGameState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const awardForLetsGo = useCallback((restaurantId: string, multiplier = 1): AwardResult => {
    const result = awardLetsGo(stateRef.current, restaurantId, toLocalDayKey(), multiplier);
    if (result.awarded) {
      stateRef.current = result.state;
      setState(result.state);
      saveGameState(result.state);
    }
    return result;
  }, []);

  const recordQuestEvent = useCallback((event: QuestEvent): QuestEventResult => {
    const result = applyQuestEvent(stateRef.current, event, toLocalDayKey());
    if (result.state !== stateRef.current) {
      stateRef.current = result.state;
      setState(result.state);
      saveGameState(result.state);
    }
    return result;
  }, []);

  // Resolved for today on every render, so a stale quest from yesterday is never shown.
  const todayKey = toLocalDayKey();
  const questProgress = resolveQuestProgress(state.quest, todayKey);
  const questView: QuestView = {
    quest: getQuestById(questProgress.questId) ?? getQuestForDay(todayKey),
    progress: questProgress.progress,
    completed: questProgress.completed,
  };

  return {
    xp: state.xp,
    coins: state.coins,
    level: getLevel(state.xp),
    xpIntoLevel: getXpIntoLevel(state.xp),
    xpPerLevel: XP_PER_LEVEL,
    awardForLetsGo,
    quest: questView,
    recordQuestEvent,
  };
}
