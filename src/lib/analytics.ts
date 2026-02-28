/* ──────────────────────────────────────────────────────────
 *  Google Analytics (GA4) helper – thin wrapper around gtag
 *
 *  The gtag script is loaded dynamically so the measurement
 *  ID can come from the VITE_GA_MEASUREMENT_ID env var.
 * ────────────────────────────────────────────────────────── */

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

type EventParams = Record<string, string | number | boolean | null | undefined>;

let initialised = false;

/**
 * Inject the gtag.js script + configure the GA4 stream.
 * Called once on app boot; silently no-ops when the env var is missing.
 */
export function initGA(): void {
  if (initialised) return;
  initialised = true;

  const id = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;
  if (!id) return;

  // 1. dataLayer + gtag function
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer!.push(args);
  };
  window.gtag('js', new Date());
  window.gtag('config', id);

  // 2. Async script tag
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(script);
}

/**
 * Fire a custom GA4 event.
 *
 * Safe to call at any time – silently no-ops if gtag hasn't loaded yet
 * (e.g. blocked by an ad blocker or missing env var).
 */
export function trackEvent(name: string, params?: EventParams): void {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', name, params);
  }
}
