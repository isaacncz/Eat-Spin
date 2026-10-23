import { lazy, Suspense, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { BrandMark } from '@/components/BrandMark';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

// The app guide lives behind "About EatSpin" on the Me screen and only loads
// when the section is opened.
const HowItWorks = lazy(() => import('@/sections/HowItWorks').then((m) => ({ default: m.HowItWorks })));
const Features = lazy(() => import('@/sections/Features').then((m) => ({ default: m.Features })));
const CTA = lazy(() => import('@/sections/CTA').then((m) => ({ default: m.CTA })));
const Footer = lazy(() => import('@/sections/Footer').then((m) => ({ default: m.Footer })));

interface AboutEatSpinProps {
  /** Called by the "Try it now" buttons inside the sections. */
  onStartSpinning: () => void;
}

/** Collapsed by default: a settings-style row that expands to the app guide. */
export function AboutEatSpin({ onStartSpinning }: AboutEatSpinProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="px-4 pt-3 pb-4 sm:px-6">
        <CollapsibleTrigger
          className={cn(
            'flex min-h-[52px] w-full items-center justify-between gap-3 rounded-2xl border-[3px] border-brand-ink bg-white px-4 text-left font-heading text-base font-semibold text-brand-ink shadow-pop',
            'outline-none focus-visible:ring-[3px] focus-visible:ring-brand-ink focus-visible:ring-offset-2',
          )}
        >
          <span className="inline-flex items-center gap-2">
            <BrandMark className="size-7" />
            About EatSpin
          </span>
          <ChevronDown
            size={20}
            aria-hidden="true"
            className={cn('shrink-0 transition-transform duration-200 motion-reduce:transition-none', isOpen && 'rotate-180')}
          />
        </CollapsibleTrigger>
      </div>

      <CollapsibleContent>
        <Suspense
          fallback={(
            <div className="flex justify-center py-12" role="status" aria-label="Loading">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-ink border-t-transparent motion-reduce:animate-none" />
            </div>
          )}
        >
          <HowItWorks onStartSpinning={onStartSpinning} />
          <Features />
          <CTA onStartSpinning={onStartSpinning} />
          <Footer />
        </Suspense>
      </CollapsibleContent>
    </Collapsible>
  );
}
