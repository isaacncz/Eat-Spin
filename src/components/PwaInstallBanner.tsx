import { Button } from '@/components/ui/button';

interface PwaInstallBannerProps {
  spinCount: number;
  onInstall: () => void;
  onDismiss: () => void;
}

/** Nudge to add EatSpin to the home screen, shown after a couple of spins. */
export function PwaInstallBanner({ spinCount, onInstall, onDismiss }: PwaInstallBannerProps) {
  return (
    <div className="rounded-2xl border-2 border-brand-ink bg-white px-4 py-3 shadow-pop">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-heading text-base font-bold text-brand-black">Install EatSpin for faster lunch decisions</p>
          <p className="text-sm text-eatspin-gray-1">
            You have spun {spinCount} times. Add EatSpin to your home screen for one-tap access.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            className="bg-brand-orange text-white hover:bg-brand-orange/90"
            onClick={onInstall}
          >
            Install App
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-brand-ink text-brand-black hover:bg-brand-linen"
            onClick={onDismiss}
          >
            Later
          </Button>
        </div>
      </div>
    </div>
  );
}
