import { flushSync } from 'react-dom';

/** Match the outgoing wheel to the restaurant card without delaying result logic. */
export function revealRestaurantFromWheel(
  wheel: HTMLElement | null,
  reveal: (shared: boolean) => void,
  highlightWinner: () => void,
): () => void {
  if (!wheel || !document.startViewTransition || document.hidden
    || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    reveal(false);
    return () => {};
  }

  let cancelled = false;
  let revealed = false;
  const originalName = wheel.style.viewTransitionName;
  const root = document.documentElement;
  const restore = () => {
    wheel.style.viewTransitionName = originalName;
    root.classList.remove('wheel-reveal-active');
  };
  const commit = () => {
    if (cancelled || revealed) return;
    revealed = true;
    // Only the incoming card owns the name in the new snapshot.
    wheel.style.viewTransitionName = originalName;
    flushSync(() => reveal(true));
  };

  flushSync(highlightWinner);
  root.classList.add('wheel-reveal-active');
  wheel.style.viewTransitionName = 'eatspin-restaurant';

  try {
    const transition = document.startViewTransition(commit);
    // A skipped animation must still show the result exactly once.
    void transition.updateCallbackDone.catch(commit);
    void transition.finished.then(restore, restore);
    return () => {
      cancelled = true;
      transition.skipTransition();
      restore();
    };
  } catch {
    commit();
    restore();
    return () => {};
  }
}
