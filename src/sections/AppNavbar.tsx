import { useState, useEffect, useCallback } from 'react';
import { Users, Info, Menu, X, LogOut } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';

interface AppNavbarProps {
  activeRoomId: string;
  onGroupSpin: () => void;
  onAbout: () => void;
  onLeaveRoom?: () => void;
}

const MOBILE_HEIGHT = 56;
const DESKTOP_HEIGHT = 48;

export function AppNavbar({
  activeRoomId,
  onGroupSpin,
  onAbout,
  onLeaveRoom,
}: AppNavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const hasActiveRoom = Boolean(activeRoomId);

  // Keep --navbar-height in sync so scroll-padding and other consumers work.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const sync = () => {
      const h = mq.matches ? DESKTOP_HEIGHT : MOBILE_HEIGHT;
      document.documentElement.style.setProperty('--navbar-height', `${h}px`);
    };
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const handler = () => {
      if (mq.matches) setMobileMenuOpen(false);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const handleGroupSpin = useCallback(() => {
    trackEvent('navbar_group_spin');
    onGroupSpin();
    setMobileMenuOpen(false);
  }, [onGroupSpin]);

  const handleAbout = useCallback(() => {
    trackEvent('navbar_about');
    onAbout();
    setMobileMenuOpen(false);
  }, [onAbout]);

  return (
    <>
      <nav
        className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b select-none"
        style={{
          height: undefined, // height driven by content + padding
          borderColor: 'rgba(254, 228, 199, 0.3)',
        }}
      >
        <div className="max-w-5xl mx-auto px-3 sm:px-4 lg:px-6">
          <div
            className="flex items-center justify-between gap-2"
            style={{ height: `var(--navbar-height, ${MOBILE_HEIGHT}px)` }}
          >
            {/* ── Logo ── */}
            <a
              href="#"
              className="flex items-center gap-1.5 shrink-0 group"
              onClick={(e) => {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              <div className="w-8 h-8 bg-brand-orange rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
                <span className="text-white font-heading text-sm font-bold leading-none">
                  ES
                </span>
              </div>
              <span className="hidden md:inline font-heading text-lg font-bold text-brand-black leading-none">
                EatSpin
              </span>
            </a>

            {/* ── Right actions ── */}
            <div className="flex items-center gap-1 shrink-0">
              {/* Desktop: Group + About visible */}
              <button
                type="button"
                onClick={handleGroupSpin}
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
                           text-brand-black/80 hover:bg-[var(--eatspin-peach)]/40 hover:text-brand-black
                           transition-colors duration-150 relative"
              >
                <Users size={16} />
                <span>Group</span>
                {hasActiveRoom && <RoomDot />}
              </button>

              {/* Leave room — desktop */}
              {hasActiveRoom && onLeaveRoom && (
                <button
                  type="button"
                  onClick={() => { onLeaveRoom(); setMobileMenuOpen(false); }}
                  className="hidden md:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium
                             text-red-600 hover:bg-red-50 hover:text-red-700
                             transition-colors duration-150"
                  aria-label="Leave group room"
                >
                  <LogOut size={14} />
                  <span>Leave</span>
                </button>
              )}

              {/* Mobile: hamburger (only for Group + About links) */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen((o) => !o)}
                className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg
                           text-brand-black/70 hover:bg-[var(--eatspin-peach)]/40
                           transition-colors duration-150 relative"
                aria-label="Menu"
              >
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                {/* Show green dot on hamburger when room is active and menu is closed */}
                {hasActiveRoom && !mobileMenuOpen && <RoomDot />}
              </button>
            </div>
          </div>
        </div>

        {/* ── Mobile dropdown ── */}
        <div
          className={`md:hidden overflow-hidden transition-[max-height,opacity] duration-200 ease-out ${
            mobileMenuOpen ? 'max-h-60 opacity-100' : 'max-h-0 opacity-0'
          }`}
          style={{ borderTop: mobileMenuOpen ? '1px solid rgba(254,228,199,0.3)' : 'none' }}
        >
          <div className="px-4 py-3 flex flex-col gap-1">
            <button
              type="button"
              onClick={handleGroupSpin}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium
                         text-brand-black/80 hover:bg-[var(--eatspin-peach)]/40 active:bg-[var(--eatspin-peach)]/60
                         transition-colors duration-150 relative"
            >
              <Users size={18} />
              <span>Group Spin</span>
              {hasActiveRoom && (
                <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  {activeRoomId}
                </span>
              )}
            </button>

            {/* Leave room — mobile */}
            {hasActiveRoom && onLeaveRoom && (
              <button
                type="button"
                onClick={() => { onLeaveRoom(); setMobileMenuOpen(false); }}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium
                           text-red-600 hover:bg-red-50 active:bg-red-100
                           transition-colors duration-150"
              >
                <LogOut size={18} />
                <span>Leave Room</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleAbout}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium
                         text-brand-black/80 hover:bg-[var(--eatspin-peach)]/40 active:bg-[var(--eatspin-peach)]/60
                         transition-colors duration-150"
            >
              <Info size={18} />
              <span>About</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Spacer so content below isn't hidden behind the fixed navbar */}
      <div
        aria-hidden
        style={{ height: `var(--navbar-height, ${MOBILE_HEIGHT}px)` }}
      />
    </>
  );
}

/* ─────────────────── Room active dot ─────────────────── */

function RoomDot() {
  return (
    <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
      <span className="absolute inset-0 rounded-full bg-emerald-400 opacity-75 animate-ping" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
    </span>
  );
}
