import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight, Play } from 'lucide-react';
import gsap from 'gsap';

interface HeroProps {
  onGetStarted: () => void;
}

export function Hero({ onGetStarted }: HeroProps) {
  const heroRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Initial setup
      gsap.set(imageRef.current, { y: 100, opacity: 0 });
      gsap.set(textRef.current?.children || [], { y: 50, opacity: 0 });

      // Animation timeline
      const tl = gsap.timeline({ delay: 0.3 });

      tl.to(imageRef.current, {
        y: 0,
        opacity: 1,
        duration: 1.2,
        ease: 'power3.out',
      })
        .to(
          textRef.current?.children || [],
          {
            y: 0,
            opacity: 1,
            duration: 0.8,
            stagger: 0.1,
            ease: 'power2.out',
          },
          '-=0.8'
        );

      // Floating animation for image
      gsap.to(imageRef.current, {
        y: -10,
        duration: 3,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });
    }, heroRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={heroRef}
      className="relative min-h-screen flex items-center overflow-hidden pt-20"
    >
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Orange blob */}
        <div
          className="absolute -top-20 -right-20 w-96 h-96 bg-brand-orange/10 rounded-full blur-3xl animate-spin-slow"
          style={{ animationDuration: '20s' }}
        />
        {/* Peach blob */}
        <div
          className="absolute -bottom-20 -left-20 w-80 h-80 bg-eatspin-peach rounded-full blur-3xl animate-spin-slow"
          style={{ animationDuration: '25s', animationDirection: 'reverse' }}
        />
        {/* Small floating circles */}
        <div className="absolute top-1/4 left-10 w-4 h-4 bg-eatspin-orange rounded-full animate-float" />
        <div
          className="absolute top-1/3 right-20 w-6 h-6 bg-eatspin-peach rounded-full animate-float"
          style={{ animationDelay: '1s' }}
        />
        <div
          className="absolute bottom-1/4 left-1/4 w-3 h-3 bg-brand-orange/50 rounded-full animate-float"
          style={{ animationDelay: '2s' }}
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Text Content */}
          <div ref={textRef} className="order-2 lg:order-1">
            <div className="inline-flex items-center gap-2.5 px-5 py-2.5 bg-gradient-to-r from-eatspin-peach/80 to-eatspin-peach rounded-full mb-6 shadow-sm border border-eatspin-orange/20">
              <span className="flex items-center justify-center w-5 h-5 bg-eatspin-orange rounded-full">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                </svg>
              </span>
              <span className="text-sm font-semibold text-eatspin-orange tracking-wide">
                #1 Food Discovery App in Penang
              </span>
            </div>

            <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold text-brand-black leading-tight mb-6">
              Hungry?{' '}
              <span className="text-brand-orange">Let's EatSpin!</span>
            </h1>

            <p className="text-lg text-eatspin-gray-1 mb-8 max-w-lg">
              Can't decide what to eat? Let our magical roulette wheel choose for you! 
              Discover amazing restaurants in Penang based on your preferences and location.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                onClick={onGetStarted}
                size="lg"
                className="bg-brand-orange hover:bg-brand-orange/90 text-white font-heading text-lg font-bold px-8 py-6 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 group"
              >
                Start Spinning
                <ArrowRight
                  size={20}
                  className="ml-2 group-hover:translate-x-1 transition-transform"
                />
              </Button>

              <Button
                variant="outline"
                size="lg"
                className="border-eatspin-orange text-eatspin-orange hover:bg-eatspin-orange/10 font-medium px-8 py-6 rounded-full"
              >
                <Play size={18} className="mr-2" />
                Watch Demo
              </Button>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-8 mt-10">
              <div>
                <p className="font-heading text-2xl font-bold text-brand-orange">30+</p>
                <p className="text-sm text-eatspin-gray-1">Restaurants</p>
              </div>
              <div className="w-px h-10 bg-eatspin-gray-3" />
              <div>
                <p className="font-heading text-2xl font-bold text-brand-orange">1-2km</p>
                <p className="text-sm text-eatspin-gray-1">Search Radius</p>
              </div>
              <div className="w-px h-10 bg-eatspin-gray-3" />
              <div>
                <p className="font-heading text-2xl font-bold text-brand-orange">Free</p>
                <p className="text-sm text-eatspin-gray-1">To Start</p>
              </div>
            </div>
          </div>

          {/* Hero Image */}
          <div ref={imageRef} className="order-1 lg:order-2 relative">
            <div className="relative">
              {/* Main image container */}
              <div className="relative rounded-3xl overflow-hidden shadow-2xl">
                <img
                  src="https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=800&h=600&fit=crop"
                  alt="Delicious food spread"
                  className="w-full h-auto object-cover"
                />
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
              </div>

              {/* Floating card - Restaurant count */}
              <div className="absolute -bottom-4 -left-4 bg-white rounded-2xl shadow-xl p-4 animate-float">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-eatspin-peach rounded-xl flex items-center justify-center">
                    <span className="text-2xl">🎯</span>
                  </div>
                  <div>
                    <p className="font-heading font-bold text-brand-black">Perfect Match</p>
                    <p className="text-sm text-eatspin-gray-1">Every spin is a winner!</p>
                  </div>
                </div>
              </div>

              {/* Floating card - Rating */}
              <div
                className="absolute -top-4 -right-4 bg-white rounded-2xl shadow-xl p-4 animate-float"
                style={{ animationDelay: '1s' }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-2xl">⭐</span>
                  <div>
                    <p className="font-heading font-bold text-brand-black">4.9</p>
                    <p className="text-xs text-eatspin-gray-1">App Rating</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
