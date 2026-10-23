import { useEffect, useRef } from 'react';
import { List, LoaderPinwheel, User, Users, type LucideIcon } from 'lucide-react';

import { APP_TABS, type AppTab } from '@/lib/appTabs';
import { cn } from '@/lib/utils';
import { BrandMark } from '@/components/BrandMark';

const TAB_ICONS: Record<AppTab, LucideIcon> = {
  spin: LoaderPinwheel,
  list: List,
  group: Users,
  me: User,
};

interface BottomNavProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  /** Shows a dot on Group while the user is in a room. */
  hasActiveRoom?: boolean;
}

/**
 * The app's only navigation: a four-tab bar pinned to the bottom of the screen
 * (thumb zone), with a safe-area inset for phones with a home indicator.
 *
 * It publishes its rendered height as `--bottom-nav-height` on <html> so page
 * padding and other pinned elements (sticky spin button, toasts) can sit above it.
 * index.css holds a matching fallback for the first paint.
 */
export function BottomNav({ activeTab, onTabChange, hasActiveRoom = false }: BottomNavProps) {
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const root = document.documentElement;
    const publishHeight = () => {
      root.style.setProperty('--bottom-nav-height', `${nav.offsetHeight}px`);
    };

    publishHeight();
    if (typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(publishHeight);
    observer.observe(nav);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--bottom-nav-height');
    };
  }, []);

  return (
    <nav
      ref={navRef}
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t-[3px] border-brand-ink bg-white"
    >
      <ul className="mx-auto flex w-full max-w-[480px] gap-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pt-2">
        {APP_TABS.map(({ id, label }) => {
          const Icon = TAB_ICONS[id];
          const isActive = id === activeTab;

          return (
            <li key={id} className="min-w-0 flex-1">
              <button
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onTabChange(id)}
                className={cn(
                  'relative flex min-h-[52px] w-full flex-col items-center justify-center gap-0.5 rounded-[14px] border-[3px] px-1 font-heading text-[13px] leading-tight text-brand-ink transition-colors motion-reduce:transition-none',
                  'outline-none focus-visible:ring-[3px] focus-visible:ring-brand-ink focus-visible:ring-offset-2',
                  isActive
                    ? 'border-brand-ink bg-arcade-pink font-bold'
                    : 'border-transparent font-semibold hover:bg-arcade-yellow/50',
                )}
              >
                {id === 'spin' ? <BrandMark className="size-[26px]" /> : <Icon size={22} strokeWidth={2.5} aria-hidden="true" />}
                <span>{label}</span>
                {id === 'group' && hasActiveRoom && (
                  <>
                    <span
                      aria-hidden="true"
                      className="absolute right-3 top-1 size-3 rounded-full border-2 border-brand-ink bg-arcade-lime"
                    />
                    <span className="sr-only">, in a room</span>
                  </>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
