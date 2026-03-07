import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

interface FirstRunOnboardingProps {
  open: boolean;
  onClose: () => void;
  onRequestLocation: () => void;
  onOpenAutoMode: () => void;
}

const steps = [
  {
    title: 'Step 1: Allow location',
    description: 'Enable location so EatSpin can preload nearby restaurants immediately.',
    actionLabel: 'Enable Location',
  },
  {
    title: 'Step 2: Load auto wheel',
    description: 'We will switch to Spin for me so your wheel is ready right away.',
    actionLabel: 'Open Auto Mode',
  },
  {
    title: 'Step 3: Tap spin',
    description: 'Tap the big spin button and let fate choose your next meal in seconds.',
    actionLabel: 'Done',
  },
];

export function FirstRunOnboarding({
  open,
  onClose,
  onRequestLocation,
  onOpenAutoMode,
}: FirstRunOnboardingProps) {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (!open) return;
    setStepIndex(0);
  }, [open]);

  if (!open) return null;

  const step = steps[stepIndex];
  const isLastStep = stepIndex === steps.length - 1;

  const handleNext = () => {
    if (stepIndex === 0) {
      onRequestLocation();
    }
    if (stepIndex === 1) {
      onOpenAutoMode();
    }

    if (isLastStep) {
      onClose();
      return;
    }

    setStepIndex((previous) => Math.min(previous + 1, steps.length - 1));
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-brand-black/50 px-4 pb-6 pt-20 sm:items-center sm:py-10">
      <div className="w-full max-w-lg rounded-2xl border border-eatspin-peach/70 bg-white p-5 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-orange">First run guide</p>
        <h3 className="mt-1 font-heading text-2xl font-bold text-brand-black">{step.title}</h3>
        <p className="mt-2 text-sm text-eatspin-gray-1">{step.description}</p>

        <div className="mt-5 flex items-center justify-between">
          <span className="text-xs text-eatspin-gray-1">Step {stepIndex + 1} of {steps.length}</span>
          <button
            type="button"
            className="text-xs font-medium text-eatspin-gray-1 underline-offset-2 hover:underline"
            onClick={onClose}
          >
            Skip
          </button>
        </div>

        <div className="mt-4 flex gap-2">
          {stepIndex > 0 && (
            <Button
              type="button"
              variant="outline"
              className="flex-1 border-brand-orange/40 text-brand-black hover:bg-brand-linen"
              onClick={() => setStepIndex((previous) => Math.max(0, previous - 1))}
            >
              Back
            </Button>
          )}
          <Button
            type="button"
            className="flex-1 bg-brand-orange text-white hover:bg-brand-orange/90"
            onClick={handleNext}
          >
            {step.actionLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
