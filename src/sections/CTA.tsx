import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function CTA() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Animate content on scroll
      gsap.fromTo(
        contentRef.current,
        { y: 50, opacity: 0, scale: 0.95 },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          duration: 0.8,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 80%',
            toggleActions: 'play none none none',
          },
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const scrollToApp = () => {
    const appSection = document.getElementById('app');
    appSection?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section
      ref={sectionRef}
      className="py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden"
    >
      {/* Background gradient - Brand Orange to Peach as per design spec */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#F54703] via-[#FF8E53] to-[#FEE4C7]" />
      
      {/* Decorative shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-20 -right-20 w-80 h-80 bg-white/60 rounded-full blur-3xl"
        />
        <div
          className="absolute -bottom-20 -left-20 w-96 h-96 bg-[#FEE4C7]/80 rounded-full blur-3xl"
        />
        {/* Floating circles */}
        <div className="absolute top-1/4 left-10 w-4 h-4 bg-[#2E2E2E]/30 rounded-full animate-float" />
        <div
          className="absolute top-1/3 right-20 w-6 h-6 bg-[#2E2E2E]/20 rounded-full animate-float"
          style={{ animationDelay: '1s' }}
        />
        <div
          className="absolute bottom-1/4 left-1/4 w-3 h-3 bg-[#2E2E2E]/40 rounded-full animate-float"
          style={{ animationDelay: '2s' }}
        />
      </div>

      <div className="relative max-w-4xl mx-auto">
        <div
          ref={contentRef}
          className="text-center"
        >
          {/* Icon */}
          <div className="w-20 h-20 bg-white/80 rounded-full flex items-center justify-center mx-auto mb-8 animate-pulse-ring">
            <Sparkles size={40} className="text-[#F54703]" />
          </div>

          {/* Heading */}
          <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold text-[#2E2E2E] mb-6">
            Ready to Spin?
          </h2>

          {/* Subtext */}
          <p className="text-lg text-[#4A4A4A] mb-8 max-w-xl mx-auto">
            Join thousands of food lovers who have already discovered their new favorite restaurants with EatSpin.
          </p>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={scrollToApp}
              size="lg"
              className="w-full sm:w-auto bg-[#2E2E2E] text-white hover:bg-[#1a1a1a] font-heading text-lg font-bold px-8 py-6 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 group"
            >
              Start Spinning Now
              <ArrowRight
                size={20}
                className="ml-2 group-hover:translate-x-1 transition-transform"
              />
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="w-full sm:w-auto border-2 border-[#2E2E2E] text-[#2E2E2E] bg-white/80 hover:bg-white font-medium px-8 py-6 rounded-full shadow-lg"
            >
              Download App
            </Button>
          </div>

          {/* Trust indicators */}
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mt-10">
            <span className="px-4 py-2 bg-[#2E2E2E]/10 text-[#2E2E2E] text-sm font-medium rounded-full border border-[#2E2E2E]/20">
              Free to use
            </span>
            <span className="px-4 py-2 bg-[#2E2E2E]/10 text-[#2E2E2E] text-sm font-medium rounded-full border border-[#2E2E2E]/20">
              No ads
            </span>
            <span className="px-4 py-2 bg-[#2E2E2E]/10 text-[#2E2E2E] text-sm font-medium rounded-full border border-[#2E2E2E]/20">
              Works anywhere
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
