import { useCallback, useEffect, useMemo, useState } from 'react';

const DISMISS_STORAGE_KEY = 'eatspin:pwa-install-dismissed-at';
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface UsePwaInstallPromptOptions {
  spinCount: number;
  showAfterSpins?: number;
}

interface UsePwaInstallPromptResult {
  shouldShowBanner: boolean;
  isPromptReady: boolean;
  dismissBanner: () => void;
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
}

const readDismissedAt = (): number => {
  if (typeof window === 'undefined') return 0;
  const rawValue = window.localStorage.getItem(DISMISS_STORAGE_KEY);
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return parsed;
};

export const usePwaInstallPrompt = ({
  spinCount,
  showAfterSpins = 2,
}: UsePwaInstallPromptOptions): UsePwaInstallPromptResult => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissedAt, setDismissedAt] = useState<number>(() => readDismissedAt());
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const dismissBanner = useCallback(() => {
    const now = Date.now();
    setDismissedAt(now);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(DISMISS_STORAGE_KEY, String(now));
    }
  }, []);

  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferredPrompt) return 'unavailable';

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return outcome;
  }, [deferredPrompt]);

  const shouldShowBanner = useMemo(() => {
    if (isInstalled) return false;
    if (!deferredPrompt) return false;
    if (spinCount < showAfterSpins) return false;
    if (!dismissedAt) return true;
    return Date.now() - dismissedAt > DISMISS_COOLDOWN_MS;
  }, [deferredPrompt, dismissedAt, isInstalled, showAfterSpins, spinCount]);

  return {
    shouldShowBanner,
    isPromptReady: Boolean(deferredPrompt),
    dismissBanner,
    promptInstall,
  };
};
