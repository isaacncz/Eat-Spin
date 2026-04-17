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

// ---------------------------------------------------------------------------
// Typed event catalogue
// ---------------------------------------------------------------------------

/** Every valid analytics event and its expected params. */
export interface AnalyticsEventMap {
  // Hero / Navigation
  quick_spin_hero_spin: { mood: string; mealTime: string };
  quick_spin_hero_group: void;
  quick_spin_hero_location_request: void;
  quick_spin_mood_select: { mood: string };
  quick_spin_tapped: void;
  search_mode_open: void;
  navbar_group_spin: void;
  navbar_about: void;
  tab_switched: { tab: string };
  mood_selected: { mood: string };
  serves_filter_toggle: { filter: string };

  // Spin lifecycle
  spin_start: { mode: string; restaurant_count: number };
  spin_complete: { mode: string; restaurant_name: string; category?: string };
  spin_blocked: { mode: string };
  spin_again_requested: { restaurant_name: string; round_size: number };
  shuffle_wheel: { restaurant_count: number };
  range_mode_changed: { mode: string };

  // Sharing
  share_result_open: { restaurant_name: string; tab: string };
  share_result_success: { restaurant_name: string; method: string; tab: string };
  share_result_failure: { restaurant_name: string; tab: string; error: string };
  spin_wrapped_share_open: { total_spins: number; current_streak: number };
  spin_wrapped_share_success: void;
  spin_wrapped_share_cancelled: void;
  spin_wrapped_share_copied: void;

  // PWA
  pwa_install_prompt_open: { spin_count: number };
  pwa_install_accepted: { spin_count: number };
  pwa_install_prompt_dismissed: { spin_count: number };
  pwa_install_banner_closed: { spin_count: number };

  // Favourites
  favourite_saved: { restaurant_name: string; mode: string };
  favourite_removed: { favourite_id: string };

  // Feedback
  feedback_given: { rating: string; restaurant_name: string };
  feedback_didnt_go: { restaurant_name: string };
  lets_go_tapped: { restaurant_name: string };

  // Onboarding
  first_run_onboarding_dismissed: void;
  first_run_onboarding_auto_mode_opened: void;

  // Challenges
  challenge_create_requested: void;
  challenge_join_requested: void;
  challenge_link_copied: void;
  challenge_left: void;

  // Categories
  category_selected: { category: string; selected_count: number };
  category_deselected: { category: string; selected_count: number };

  // Manual lists
  manual_list_selected: { list_id: string; list_name: string; count: number };
  manual_list_created: { list_id: string; list_name: string; meal_time: string };
  manual_list_updated: { list_id: string; list_name: string; meal_time: string; count: number };
  manual_list_saved_from_room: { room_id: string; list_id: string; list_name: string; count: number };
  manual_list_deleted: { list_id: string; list_name: string };
  manual_restaurant_added: { name: string };
  manual_restaurant_removed: { name: string };

  // Group spin
  group_spin_requested: { room_id: string; restaurant_count: number };
  group_room_created: void;
  group_room_joined: { room_id: string };
  group_room_left: { room_id: string };
}

/** All valid event names. */
export type AnalyticsEventName = keyof AnalyticsEventMap;

// ---------------------------------------------------------------------------
// Runtime
// ---------------------------------------------------------------------------

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

/**
 * Send a typed GA4 event.
 * Events with no params use `void`; pass nothing for the second argument.
 */
export function trackEvent<K extends AnalyticsEventName>(
  ...args: AnalyticsEventMap[K] extends void
    ? [name: K]
    : [name: K, params: AnalyticsEventMap[K]]
): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  const [name, params] = args as [string, Record<string, unknown> | undefined];
  window.gtag('event', name, params);
}
