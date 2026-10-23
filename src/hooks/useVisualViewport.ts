import { useEffect, useState } from 'react';

export interface VisualViewportBox {
  height: number;
  offsetTop: number;
}

/** Tracks the visible area (above the on-screen keyboard). Null when unsupported or disabled. */
export function useVisualViewport(enabled: boolean): VisualViewportBox | null {
  const [box, setBox] = useState<VisualViewportBox | null>(null);
  useEffect(() => {
    const vv = typeof window === 'undefined' ? null : window.visualViewport;
    if (!enabled || !vv) return;
    const update = () => setBox({ height: vv.height, offsetTop: vv.offsetTop });
    const initial = requestAnimationFrame(update);
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => { cancelAnimationFrame(initial); vv.removeEventListener('resize', update); vv.removeEventListener('scroll', update); };
  }, [enabled]);
  return enabled ? box : null;
}
