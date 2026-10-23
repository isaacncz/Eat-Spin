/**
 * Diameter cap for the wheel on the Spin screen. Phone width limits it first. On short
 * screens the height left after the HUD, heading, quick picks, Filters button and the
 * pinned Spin button (about 21rem together, with the one-row HUD) does, so the wheel and the button are both
 * visible on a 360x640 phone. Never below 13rem; the page scrolls instead.
 * `--bottom-nav-height` is measured by BottomNav and already includes the safe area.
 */
export const SPIN_SCREEN_WHEEL_SIZE =
  'max(13rem, min(21rem, calc(100dvh - var(--bottom-nav-height) - 21rem)))';
