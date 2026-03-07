import { useState, useEffect, useCallback } from 'react';
import type { PendingFeedback } from '@/lib/feedbackStore';
import { getReadyFeedback, dequeueFeedback } from '@/lib/feedbackStore';

interface UseFeedbackPromptReturn {
  /** The feedback entry that is ready to show, or null. */
  pending: PendingFeedback | null;
  /** Dismiss the current feedback (user responded or skipped). */
  dismiss: () => void;
}

/**
 * On mount, checks if any pending feedback is older than 2 hours.
 * Returns the first ready entry for the UI to prompt.
 */
export const useFeedbackPrompt = (): UseFeedbackPromptReturn => {
  const [pending, setPending] = useState<PendingFeedback | null>(null);

  useEffect(() => {
    const ready = getReadyFeedback();
    setPending(ready);
  }, []);

  const dismiss = useCallback(() => {
    if (pending) {
      dequeueFeedback(pending.favouriteId);
    }
    // Try to find the next one
    const next = getReadyFeedback();
    setPending(next);
  }, [pending]);

  return { pending, dismiss };
};
