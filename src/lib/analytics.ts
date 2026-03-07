/**
 * Google Analytics (GA4) helper.
 * Loads gtag.js at runtime using VITE_GA_MEASUREMENT_ID.
 */

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

type EventParams = Record<string, string | number | boolean | null | undefined>;

let initialised = false;

const getMeasurementId = (): string | undefined => {
  const id = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;
  return id && id.trim().length > 0 ? id.trim() : undefined;
};

export function initGA(): void {
  if (initialised || typeof window === 'undefined') return;
  initialised = true;

  const id = getMeasurementId();
  if (!id) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(): void {
    window.dataLayer!.push(arguments);
  } as unknown as (...args: unknown[]) => void;

  window.gtag('js', new Date());
  window.gtag('config', id);

  const existingScript = document.querySelector<HTMLScriptElement>(
    `script[data-ga-measurement-id="${id}"]`,
  );
  if (existingScript) return;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  script.dataset.gaMeasurementId = id;
  script.onerror = () => {
    console.warn('GA script failed to load');
  };
  document.head.appendChild(script);
}

export function trackEvent(name: string, params?: EventParams): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  window.gtag('event', name, params);
}
