import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { getPlaceInitial, getPlaceTileColor, type PlaceTileColor } from '@/lib/placeTile';
import { cn } from '@/lib/utils';

/**
 * Small building blocks shared by the My list, Group and Me screens, so the three
 * screens look like one set. Text on bright colours is always ink; white text is
 * only ever used on brand-orange (none of these blocks use it).
 */

/** Page gutter, 16px with a floor at the device safe-area inset for notched landscape phones. */
export const SCREEN_GUTTER = 'pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]';

export const FOCUS_RING =
  'outline-none focus-visible:ring-[3px] focus-visible:ring-brand-ink focus-visible:ring-offset-2';

type ArcadeButtonVariant = 'pink' | 'cyan' | 'lime' | 'white' | 'yellow';
type ArcadeButtonSize = 'md' | 'lg';

const BUTTON_VARIANTS: Record<ArcadeButtonVariant, string> = {
  pink: 'bg-arcade-pink',
  cyan: 'bg-arcade-cyan',
  lime: 'bg-arcade-lime',
  white: 'bg-white',
  yellow: 'bg-arcade-yellow',
};

const BUTTON_SIZES: Record<ArcadeButtonSize, string> = {
  // 48px tall, the secondary action size.
  md: 'min-h-12 rounded-2xl border-[3px] px-4 text-base',
  // 60px tall with the hard shadow, the one primary action pinned on a screen.
  lg: 'min-h-[60px] rounded-[20px] border-4 px-5 text-xl shadow-pop-lg',
};

interface ArcadeButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ArcadeButtonVariant;
  size?: ArcadeButtonSize;
}

export function ArcadeButton({
  variant = 'white',
  size = 'md',
  type = 'button',
  className,
  ...props
}: ArcadeButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 border-brand-ink font-heading font-bold leading-tight text-brand-ink',
        'transition-transform motion-reduce:transition-none',
        'enabled:active:translate-y-[3px] enabled:active:shadow-none motion-reduce:enabled:active:translate-y-0',
        'disabled:cursor-not-allowed disabled:opacity-60',
        FOCUS_RING,
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...props}
    />
  );
}

/** Square icon-only button, 44x44. Always pass an `aria-label`. */
export function ArcadeIconButton({
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { 'aria-label': string }) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-brand-ink',
        'transition-colors hover:bg-arcade-yellow/60 motion-reduce:transition-none',
        'disabled:cursor-not-allowed disabled:opacity-40',
        FOCUS_RING,
        className,
      )}
      {...props}
    />
  );
}

const TILE_BACKGROUNDS: Record<PlaceTileColor, string> = {
  pink: 'bg-arcade-pink',
  cyan: 'bg-arcade-cyan',
  lime: 'bg-arcade-lime',
  orange: 'bg-arcade-orange',
  violet: 'bg-arcade-violet',
};

interface InitialTileProps {
  name: string;
  /** `square` is the 40px place tile, `round` is the 36px person avatar. */
  shape?: 'square' | 'round';
  /** Overrides the colour that would be picked from the name. */
  color?: PlaceTileColor;
}

/** Coloured tile with the first letter of a place or person. Decorative: the name sits next to it. */
export function InitialTile({ name, shape = 'square', color }: InitialTileProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center border-[3px] border-brand-ink font-heading font-bold text-brand-ink',
        shape === 'square' ? 'size-10 rounded-xl text-lg' : 'size-9 rounded-full text-base',
        TILE_BACKGROUNDS[color ?? getPlaceTileColor(name)],
      )}
    >
      {getPlaceInitial(name)}
    </span>
  );
}

interface ScreenFrameProps {
  title: string;
  subtitle?: ReactNode;
  headerAction?: ReactNode;
  children: ReactNode;
  /**
   * The screen's primary action. Sticks just above the bottom tab bar, and because it is
   * part of the page flow it also reserves its own space, so nothing scrolls behind it.
   */
  pinned?: ReactNode;
}

/** Title, scrolling body and an optional pinned footer. At least one screen tall so the footer reaches the bar. */
export function ScreenFrame({ title, subtitle, headerAction, children, pinned }: ScreenFrameProps) {
  return (
    <div className="flex min-h-[calc(100dvh_-_var(--bottom-nav-height))] flex-col">
      <header className={cn('flex items-start justify-between gap-3 pt-6', SCREEN_GUTTER)}>
        <div className="min-w-0">
          <h1 className="font-heading text-[30px] font-bold leading-[1.1] text-brand-ink">{title}</h1>
          {subtitle && (
            <p className="mt-0.5 font-heading text-[15px] font-medium text-eatspin-gray-1">{subtitle}</p>
          )}
        </div>
        {headerAction}
      </header>

      <div className={cn('flex flex-1 flex-col gap-3.5 pb-4 pt-3', SCREEN_GUTTER)}>{children}</div>

      {pinned && (
        <div
          className={cn(
            'sticky bottom-[var(--bottom-nav-height)] z-30 bg-arcade-yellow pb-3 pt-2',
            SCREEN_GUTTER,
          )}
        >
          {pinned}
        </div>
      )}
    </div>
  );
}

/** Small muted heading above a group of rows, as in the boards. */
export function SectionLabel({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2 id={id} className="mb-2 font-heading text-sm font-semibold text-eatspin-gray-1">
      {children}
    </h2>
  );
}
