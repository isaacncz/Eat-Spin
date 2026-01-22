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
      {/* Background gradient - now much darker for contrast */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#2E2E2E] via-[#1a1a1a] to-[#3a1a00]" />
      
      {/* Decorative shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-20 -right-20 w-80 h-80 bg-white/10 rounded-full blur-3xl"
        />
        <div
          className="absolute -bottom-20 -left-20 w-96 h-96 bg-orange-300/20 rounded-full blur-3xl"
        />
        {/* Floating circles */}
        <div className="absolute top-1/4 left-10 w-4 h-4 bg-white/30 rounded-full animate-float" />
        <div
          className="absolute top-1/3 right-20 w-6 h-6 bg-white/20 rounded-full animate-float"
          style={{ animationDelay: '1s' }}
        />
        <div
          className="absolute bottom-1/4 left-1/4 w-3 h-3 bg-white/40 rounded-full animate-float"
          style={{ animationDelay: '2s' }}
        />
      </div>

      <div className="relative max-w-4xl mx-auto">
        <div
          ref={contentRef}
          className="text-center"
        >
          {/* Icon */}
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-8 animate-pulse-ring">
            <Sparkles size={40} className="text-white" />
          </div>

          {/* Heading */}
          <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
            Ready to Spin?
          </h2>

          {/* Subtext */}
          <p className="text-lg text-white/90 mb-8 max-w-xl mx-auto">
            Join thousands of food lovers in Penang who have already discovered their new favorite restaurants with EatSpin.
          </p>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={scrollToApp}
              size="lg"
              className="bg-white text-brand-orange hover:bg-white/90 font-heading text-lg font-bold px-8 py-6 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 group"
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
              className="border-2 border-white text-white bg-[#232323] hover:bg-[#333] font-medium px-8 py-6 rounded-full shadow-lg"
            >
              Download App
            </Button>
          </div>

          {/* Trust indicators */}
          <div className="flex items-center justify-center gap-6 mt-10 text-white/80 text-sm">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 bg-white rounded-full" />
              Free to use
            </span>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 bg-white rounded-full" />
              No ads
            </span>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 bg-white rounded-full" />
              Penang focused
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
